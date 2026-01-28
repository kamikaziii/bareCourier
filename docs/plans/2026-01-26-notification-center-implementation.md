# Notification Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-channel notifications (push/email) with granular per-category preferences, quiet hours, and an enhanced dropdown UI.

**Architecture:** New `notification_preferences` JSONB column on profiles stores per-category channel settings and quiet hours config. A shared `dispatchNotification` helper in edge functions routes notifications through appropriate channels based on user preferences.

**Tech Stack:** SvelteKit, Svelte 5 runes, Supabase Edge Functions (Deno), shadcn-svelte, Paraglide i18n

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/XXX_add_notification_preferences.sql`

**Step 1: Create migration file**

```sql
-- Migration: Add notification preferences to profiles

-- 1. Add notification_preferences column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "categories": {
    "new_request": {"inApp": true, "push": true, "email": true},
    "schedule_change": {"inApp": true, "push": true, "email": false},
    "past_due": {"inApp": true, "push": true, "email": false},
    "daily_summary": {"inApp": true, "push": false, "email": true},
    "service_status": {"inApp": true, "push": false, "email": true}
  },
  "quietHours": {
    "enabled": false,
    "start": "21:00",
    "end": "08:00"
  },
  "workingDaysOnly": true
}';

-- 2. Backfill existing profiles with default preferences
UPDATE profiles
SET notification_preferences = '{
  "categories": {
    "new_request": {"inApp": true, "push": true, "email": true},
    "schedule_change": {"inApp": true, "push": true, "email": false},
    "past_due": {"inApp": true, "push": true, "email": false},
    "daily_summary": {"inApp": true, "push": false, "email": true},
    "service_status": {"inApp": true, "push": false, "email": true}
  },
  "quietHours": {
    "enabled": false,
    "start": "21:00",
    "end": "08:00"
  },
  "workingDaysOnly": true
}'::jsonb
WHERE notification_preferences IS NULL;

-- 3. Update notification type constraint to include new categories
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'service_status',
  'new_request',
  'schedule_change',
  'service_created',
  'past_due',
  'daily_summary'
));
```

**Step 2: Apply migration via Supabase MCP**

Run: `mcp__supabase__apply_migration` with name `add_notification_preferences` and the SQL above.

**Step 3: Verify migration**

Run: `mcp__supabase__execute_sql` with:
```sql
SELECT notification_preferences FROM profiles LIMIT 1;
```
Expected: JSON object with categories, quietHours, workingDaysOnly

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add notification_preferences column with backfill"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts:19-32` (add NotificationPreferences type)
- Modify: `src/lib/database.types.ts:316` (update notification type union)
- Modify: `src/lib/database.types.ts:68-96` (add to Profile Row type)

**Step 1: Add NotificationPreferences type after PastDueSettings**

In `src/lib/database.types.ts`, after line 32 (after PastDueSettings closing brace), add:

```typescript
// Notification channel preferences per category
export type NotificationCategory =
  | 'new_request'
  | 'schedule_change'
  | 'past_due'
  | 'daily_summary'
  | 'service_status';

export type ChannelPreferences = {
  inApp: boolean;
  push: boolean;
  email: boolean;
};

export type NotificationPreferences = {
  categories: Record<NotificationCategory, ChannelPreferences>;
  quietHours: {
    enabled: boolean;
    start: string;  // "HH:MM" format
    end: string;    // "HH:MM" format
  };
  workingDaysOnly: boolean;
};
```

**Step 2: Update notification type union**

Find the notification type definitions (around line 316) and update:

```typescript
// OLD:
type: 'service_status' | 'new_request' | 'schedule_change' | 'service_created';

// NEW:
type: 'service_status' | 'new_request' | 'schedule_change' | 'service_created' | 'past_due' | 'daily_summary';
```

Do this for Row, Insert, and Update types (3 places).

**Step 3: Add notification_preferences to Profile Row type**

In the profiles Row type (around line 68-96), add after `working_days`:

```typescript
notification_preferences: NotificationPreferences | null;
```

Also add to Insert and Update types.

**Step 4: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(types): add NotificationPreferences and update notification types"
```

---

## Task 3: Default Constants

**Files:**
- Modify: `src/lib/constants/scheduling.ts`

**Step 1: Add default notification preferences**

After `DEFAULT_PAST_DUE_SETTINGS` (around line 35), add:

```typescript
import type { NotificationPreferences } from '$lib/database.types';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: {
    new_request: { inApp: true, push: true, email: true },
    schedule_change: { inApp: true, push: true, email: false },
    past_due: { inApp: true, push: true, email: false },
    daily_summary: { inApp: true, push: false, email: true },
    service_status: { inApp: true, push: false, email: true }
  },
  quietHours: {
    enabled: false,
    start: '21:00',
    end: '08:00'
  },
  workingDaysOnly: true
};
```

**Step 2: Update import at top of file**

```typescript
import type { TimeSlotDefinitions, WorkingDay, PastDueSettings, NotificationPreferences } from '$lib/database.types';
```

**Step 3: Run type check**

Run: `pnpm run check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/constants/scheduling.ts
git commit -m "feat(constants): add DEFAULT_NOTIFICATION_PREFERENCES"
```

---

## Task 4: i18n Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English i18n keys**

Add to `messages/en.json`:

```json
"settings_notification_preferences": "Notification Preferences",
"settings_notification_preferences_desc": "Choose how you want to be notified for each type of event",
"settings_category_new_request": "New service requests",
"settings_category_new_request_desc": "When clients create new pickup/delivery requests",
"settings_category_schedule_change": "Schedule changes",
"settings_category_schedule_change_desc": "Reschedule requests from clients",
"settings_category_past_due": "Past due alerts",
"settings_category_past_due_desc": "Reminders when deliveries are running late",
"settings_category_daily_summary": "Daily summary",
"settings_category_daily_summary_desc": "Morning overview of the day's deliveries",
"settings_category_service_status": "Service status updates",
"settings_category_service_status_desc": "When service status changes (delivered, etc.)",
"settings_channel_in_app": "In-App",
"settings_channel_push": "Push",
"settings_channel_email": "Email",
"settings_quiet_hours": "Quiet Hours",
"settings_quiet_hours_desc": "Pause push and email notifications during off-hours",
"settings_quiet_hours_enabled": "Enable quiet hours",
"settings_quiet_hours_from": "From",
"settings_quiet_hours_to": "To",
"settings_working_days_only": "Only notify on working days",
"settings_working_days_only_desc": "Uses your configured working days",
"notification_tab_all": "All",
"notification_tab_requests": "Requests",
"notification_tab_alerts": "Alerts",
"notification_filter_unread": "Unread",
"notification_time_today": "Today",
"notification_time_earlier": "Earlier"
```

**Step 2: Add Portuguese i18n keys**

Add equivalent keys to `messages/pt-PT.json`:

```json
"settings_notification_preferences": "Preferências de Notificação",
"settings_notification_preferences_desc": "Escolha como quer ser notificado para cada tipo de evento",
"settings_category_new_request": "Novos pedidos de serviço",
"settings_category_new_request_desc": "Quando clientes criam novos pedidos de recolha/entrega",
"settings_category_schedule_change": "Alterações de agendamento",
"settings_category_schedule_change_desc": "Pedidos de reagendamento de clientes",
"settings_category_past_due": "Alertas de atraso",
"settings_category_past_due_desc": "Lembretes quando entregas estão atrasadas",
"settings_category_daily_summary": "Resumo diário",
"settings_category_daily_summary_desc": "Visão geral matinal das entregas do dia",
"settings_category_service_status": "Atualizações de estado",
"settings_category_service_status_desc": "Quando o estado do serviço muda (entregue, etc.)",
"settings_channel_in_app": "Na App",
"settings_channel_push": "Push",
"settings_channel_email": "Email",
"settings_quiet_hours": "Horas de Silêncio",
"settings_quiet_hours_desc": "Pausar notificações push e email fora do horário",
"settings_quiet_hours_enabled": "Ativar horas de silêncio",
"settings_quiet_hours_from": "De",
"settings_quiet_hours_to": "Até",
"settings_working_days_only": "Notificar apenas em dias úteis",
"settings_working_days_only_desc": "Usa os seus dias de trabalho configurados",
"notification_tab_all": "Todas",
"notification_tab_requests": "Pedidos",
"notification_tab_alerts": "Alertas",
"notification_filter_unread": "Não lidas",
"notification_time_today": "Hoje",
"notification_time_earlier": "Anteriores"
```

**Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add notification center i18n keys"
```

---

## Task 5: Settings UI - Notification Preferences Matrix

**Files:**
- Modify: `src/routes/courier/settings/NotificationsTab.svelte`

**Step 1: Add imports and state**

At top of `<script>`, add to imports:

```typescript
import { Checkbox } from '$lib/components/ui/checkbox/index.js';
import type { NotificationPreferences } from '$lib/database.types.js';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '$lib/constants/scheduling.js';
```

Add state after `pastDueSettings` state:

```typescript
// Notification preferences state (merge defaults with existing)
// svelte-ignore state_referenced_locally - intentional: capture initial value for form
let notificationPrefs = $state<NotificationPreferences>({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...(profile.notification_preferences ?? {})
});
```

**Step 2: Add helper function**

Add after `togglePushNotifications` function:

```typescript
function updateCategoryPref(
  category: keyof NotificationPreferences['categories'],
  channel: 'inApp' | 'push' | 'email',
  value: boolean
) {
  notificationPrefs = {
    ...notificationPrefs,
    categories: {
      ...notificationPrefs.categories,
      [category]: {
        ...notificationPrefs.categories[category],
        [channel]: value
      }
    }
  };
}
```

**Step 3: Add preferences matrix UI**

After the "Notification Preferences" Card (after line 165), add new Card:

```svelte
<!-- Notification Preferences Matrix -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Bell class="size-5" />
      {m.settings_notification_preferences()}
    </Card.Title>
    <Card.Description>{m.settings_notification_preferences_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="POST" action="?/updateNotificationPreferences" use:enhance class="space-y-4">
      <input type="hidden" name="notification_preferences" value={JSON.stringify(notificationPrefs)} />

      <!-- Header row -->
      <div class="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
        <div></div>
        <div class="text-center">{m.settings_channel_in_app()}</div>
        <div class="text-center">{m.settings_channel_push()}</div>
        <div class="text-center">{m.settings_channel_email()}</div>
      </div>

      <!-- New requests row -->
      <div class="grid grid-cols-4 gap-4 items-center">
        <div>
          <p class="text-sm font-medium">{m.settings_category_new_request()}</p>
          <p class="text-xs text-muted-foreground">{m.settings_category_new_request_desc()}</p>
        </div>
        <div class="flex justify-center">
          <Checkbox checked={notificationPrefs.categories.new_request.inApp} disabled />
        </div>
        <div class="flex justify-center">
          <Checkbox
            checked={notificationPrefs.categories.new_request.push}
            onCheckedChange={(v) => updateCategoryPref('new_request', 'push', v === true)}
            disabled={!pushSupported || !pushEnabled}
          />
        </div>
        <div class="flex justify-center">
          <Checkbox
            checked={notificationPrefs.categories.new_request.email}
            onCheckedChange={(v) => updateCategoryPref('new_request', 'email', v === true)}
            disabled={!emailEnabled}
          />
        </div>
      </div>

      <!-- Schedule changes row -->
      <div class="grid grid-cols-4 gap-4 items-center">
        <div>
          <p class="text-sm font-medium">{m.settings_category_schedule_change()}</p>
          <p class="text-xs text-muted-foreground">{m.settings_category_schedule_change_desc()}</p>
        </div>
        <div class="flex justify-center">
          <Checkbox checked={notificationPrefs.categories.schedule_change.inApp} disabled />
        </div>
        <div class="flex justify-center">
          <Checkbox
            checked={notificationPrefs.categories.schedule_change.push}
            onCheckedChange={(v) => updateCategoryPref('schedule_change', 'push', v === true)}
            disabled={!pushSupported || !pushEnabled}
          />
        </div>
        <div class="flex justify-center">
          <Checkbox
            checked={notificationPrefs.categories.schedule_change.email}
            onCheckedChange={(v) => updateCategoryPref('schedule_change', 'email', v === true)}
            disabled={!emailEnabled}
          />
        </div>
      </div>

      <!-- Past due row -->
      <div class="grid grid-cols-4 gap-4 items-center">
        <div>
          <p class="text-sm font-medium">{m.settings_category_past_due()}</p>
          <p class="text-xs text-muted-foreground">{m.settings_category_past_due_desc()}</p>
        </div>
        <div class="flex justify-center">
          <Checkbox checked={notificationPrefs.categories.past_due.inApp} disabled />
        </div>
        <div class="flex justify-center">
          <Checkbox
            checked={notificationPrefs.categories.past_due.push}
            onCheckedChange={(v) => updateCategoryPref('past_due', 'push', v === true)}
            disabled={!pushSupported || !pushEnabled}
          />
        </div>
        <div class="flex justify-center">
          <Checkbox
            checked={notificationPrefs.categories.past_due.email}
            onCheckedChange={(v) => updateCategoryPref('past_due', 'email', v === true)}
            disabled={!emailEnabled}
          />
        </div>
      </div>

      <!-- Daily summary row -->
      <div class="grid grid-cols-4 gap-4 items-center">
        <div>
          <p class="text-sm font-medium">{m.settings_category_daily_summary()}</p>
          <p class="text-xs text-muted-foreground">{m.settings_category_daily_summary_desc()}</p>
        </div>
        <div class="flex justify-center">
          <Checkbox checked={notificationPrefs.categories.daily_summary.inApp} disabled />
        </div>
        <div class="flex justify-center">
          <Checkbox
            checked={notificationPrefs.categories.daily_summary.push}
            onCheckedChange={(v) => updateCategoryPref('daily_summary', 'push', v === true)}
            disabled={!pushSupported || !pushEnabled}
          />
        </div>
        <div class="flex justify-center">
          <Checkbox
            checked={notificationPrefs.categories.daily_summary.email}
            onCheckedChange={(v) => updateCategoryPref('daily_summary', 'email', v === true)}
            disabled={!emailEnabled}
          />
        </div>
      </div>

      <Button type="submit" class="mt-4">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>
```

**Step 4: Run dev server and verify**

Run: `pnpm run dev`
Navigate to: `/courier/settings`
Expected: See new "Notification Preferences" card with checkbox matrix

**Step 5: Commit**

```bash
git add src/routes/courier/settings/NotificationsTab.svelte
git commit -m "feat(settings): add notification preferences matrix UI"
```

---

## Task 6: Settings UI - Quiet Hours

**Files:**
- Modify: `src/routes/courier/settings/NotificationsTab.svelte`

**Step 1: Add quiet hours UI after preferences matrix**

```svelte
<!-- Quiet Hours -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Clock class="size-5" />
      {m.settings_quiet_hours()}
    </Card.Title>
    <Card.Description>{m.settings_quiet_hours_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="POST" action="?/updateNotificationPreferences" use:enhance class="space-y-4">
      <input type="hidden" name="notification_preferences" value={JSON.stringify(notificationPrefs)} />

      <!-- Enable toggle -->
      <div class="flex items-center justify-between">
        <Label>{m.settings_quiet_hours_enabled()}</Label>
        <Switch
          checked={notificationPrefs.quietHours.enabled}
          onCheckedChange={(checked) => {
            notificationPrefs = {
              ...notificationPrefs,
              quietHours: { ...notificationPrefs.quietHours, enabled: checked }
            };
          }}
        />
      </div>

      {#if notificationPrefs.quietHours.enabled}
        <div class="flex items-center gap-4">
          <div class="space-y-1">
            <Label>{m.settings_quiet_hours_from()}</Label>
            <Input
              type="time"
              lang={getLocale()}
              value={notificationPrefs.quietHours.start}
              onchange={(e) => {
                notificationPrefs = {
                  ...notificationPrefs,
                  quietHours: { ...notificationPrefs.quietHours, start: e.currentTarget.value }
                };
              }}
              class="w-28"
            />
          </div>
          <div class="space-y-1">
            <Label>{m.settings_quiet_hours_to()}</Label>
            <Input
              type="time"
              lang={getLocale()}
              value={notificationPrefs.quietHours.end}
              onchange={(e) => {
                notificationPrefs = {
                  ...notificationPrefs,
                  quietHours: { ...notificationPrefs.quietHours, end: e.currentTarget.value }
                };
              }}
              class="w-28"
            />
          </div>
        </div>
      {/if}

      <Separator />

      <!-- Working days only -->
      <div class="flex items-center justify-between">
        <div>
          <Label>{m.settings_working_days_only()}</Label>
          <p class="text-xs text-muted-foreground">{m.settings_working_days_only_desc()}</p>
        </div>
        <Switch
          checked={notificationPrefs.workingDaysOnly}
          onCheckedChange={(checked) => {
            notificationPrefs = { ...notificationPrefs, workingDaysOnly: checked };
          }}
        />
      </div>

      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>
```

**Step 2: Add Clock import**

Update imports at top:
```typescript
import { Bell, Globe, Clock } from '@lucide/svelte';
```

**Step 3: Verify UI**

Run: `pnpm run dev`
Expected: Quiet hours card appears with time pickers

**Step 4: Commit**

```bash
git add src/routes/courier/settings/NotificationsTab.svelte
git commit -m "feat(settings): add quiet hours UI"
```

---

## Task 7: Server Action for Saving Preferences

**Files:**
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Add/update action for notification preferences**

Find the `updateNotificationPreferences` action and update it (or create if missing):

```typescript
updateNotificationPreferences: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const roleError = await requireCourier(supabase, user.id);
  if (roleError) return roleError;

  const formData = await request.formData();

  // Handle both the old email toggle and the new full preferences
  const notificationPrefsJson = formData.get('notification_preferences') as string | null;
  const emailEnabledStr = formData.get('email_notifications_enabled') as string | null;

  const updateData: Record<string, unknown> = {};

  if (notificationPrefsJson) {
    try {
      const prefs = JSON.parse(notificationPrefsJson);
      updateData.notification_preferences = prefs;
    } catch {
      return { success: false, error: 'Invalid notification preferences' };
    }
  }

  if (emailEnabledStr !== null) {
    updateData.email_notifications_enabled = emailEnabledStr === 'true';
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No data to update' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update(updateData)
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, message: 'preferences_updated' };
},
```

**Step 2: Test saving preferences**

1. Run: `pnpm run dev`
2. Navigate to settings
3. Toggle a checkbox in the matrix
4. Click Save
5. Refresh page
Expected: Setting persists

**Step 3: Commit**

```bash
git add src/routes/courier/settings/+page.server.ts
git commit -m "feat(settings): add server action for notification preferences"
```

---

## Task 8: Enhanced Dropdown - Category Tabs

**Files:**
- Modify: `src/lib/components/NotificationBell.svelte`

**Step 1: Add tab state and filtered list**

After `let open = $state(false);` add:

```typescript
type TabFilter = 'all' | 'requests' | 'alerts';
let activeTab = $state<TabFilter>('all');
let showUnreadOnly = $state(false);

const filteredNotifications = $derived(() => {
  let filtered = notifications;

  // Filter by tab
  if (activeTab === 'requests') {
    filtered = filtered.filter(n => ['new_request', 'schedule_change'].includes(n.type));
  } else if (activeTab === 'alerts') {
    filtered = filtered.filter(n => ['past_due', 'service_status', 'daily_summary'].includes(n.type));
  }

  // Filter by unread
  if (showUnreadOnly) {
    filtered = filtered.filter(n => !n.read);
  }

  return filtered;
});
```

**Step 2: Add tabs UI after header**

Replace the content section (after Separator) with:

```svelte
<Separator />

<!-- Tabs and filter -->
<div class="flex items-center justify-between px-3 py-2 border-b">
  <div class="flex gap-1">
    <Button
      variant={activeTab === 'all' ? 'secondary' : 'ghost'}
      size="sm"
      class="h-7 text-xs"
      onclick={() => activeTab = 'all'}
    >
      {m.notification_tab_all()}
    </Button>
    <Button
      variant={activeTab === 'requests' ? 'secondary' : 'ghost'}
      size="sm"
      class="h-7 text-xs"
      onclick={() => activeTab = 'requests'}
    >
      {m.notification_tab_requests()}
    </Button>
    <Button
      variant={activeTab === 'alerts' ? 'secondary' : 'ghost'}
      size="sm"
      class="h-7 text-xs"
      onclick={() => activeTab = 'alerts'}
    >
      {m.notification_tab_alerts()}
    </Button>
  </div>
  <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
    <input
      type="checkbox"
      bind:checked={showUnreadOnly}
      class="size-3 rounded"
    />
    {m.notification_filter_unread()}
  </label>
</div>
```

**Step 3: Update notifications loop to use filtered list**

Change:
```svelte
{#each notifications as notification (notification.id)}
```
To:
```svelte
{#each filteredNotifications as notification (notification.id)}
```

**Step 4: Verify tabs work**

Run: `pnpm run dev`
Expected: Clicking tabs filters the notification list

**Step 5: Commit**

```bash
git add src/lib/components/NotificationBell.svelte
git commit -m "feat(dropdown): add category tabs and unread filter"
```

---

## Task 9: Enhanced Dropdown - Time Grouping

**Files:**
- Modify: `src/lib/components/NotificationBell.svelte`

**Step 1: Add time grouping helper**

After `formatRelativeTime` function, add:

```typescript
function getTimeGroup(dateStr: string): 'today' | 'earlier' {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date >= today ? 'today' : 'earlier';
}

const groupedNotifications = $derived(() => {
  const today: Notification[] = [];
  const earlier: Notification[] = [];

  for (const n of filteredNotifications) {
    if (getTimeGroup(n.created_at) === 'today') {
      today.push(n);
    } else {
      earlier.push(n);
    }
  }

  return { today, earlier };
});
```

**Step 2: Update template to show groups**

Replace the `{#each filteredNotifications...}` loop with:

```svelte
{#if groupedNotifications.today.length > 0}
  <div class="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
    {m.notification_time_today()}
  </div>
  {#each groupedNotifications.today as notification (notification.id)}
    {@const Icon = getNotificationIcon(notification.type)}
    <!-- ... existing notification button markup ... -->
  {/each}
{/if}

{#if groupedNotifications.earlier.length > 0}
  <div class="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
    {m.notification_time_earlier()}
  </div>
  {#each groupedNotifications.earlier as notification (notification.id)}
    {@const Icon = getNotificationIcon(notification.type)}
    <!-- ... existing notification button markup ... -->
  {/each}
{/if}

{#if groupedNotifications.today.length === 0 && groupedNotifications.earlier.length === 0}
  <div class="px-3 py-4 text-center text-sm text-muted-foreground">
    {m.no_notifications()}
  </div>
{/if}
```

**Step 3: Verify grouping**

Run: `pnpm run dev`
Expected: Notifications grouped under "Today" and "Earlier" headers

**Step 4: Commit**

```bash
git add src/lib/components/NotificationBell.svelte
git commit -m "feat(dropdown): add time grouping (Today/Earlier)"
```

---

## Task 10: Enhanced Dropdown - Settings Link

**Files:**
- Modify: `src/lib/components/NotificationBell.svelte`

**Step 1: Add Settings icon import**

```typescript
import { Bell, CheckCheck, Package, Clock, CalendarClock, Settings, AlertTriangle, BarChart3 } from '@lucide/svelte';
```

**Step 2: Add settings link in header**

Update the header div:

```svelte
<div class="flex items-center justify-between px-3 py-2">
  <span class="font-semibold">{m.notifications()}</span>
  <div class="flex items-center gap-2">
    {#if unreadCount > 0}
      <Button variant="ghost" size="sm" class="h-auto p-0 text-xs" onclick={markAllAsRead}>
        {m.mark_all_read()}
      </Button>
    {/if}
    <Button
      variant="ghost"
      size="icon"
      class="size-6"
      onclick={() => {
        open = false;
        goto(localizeHref(userRole === 'courier' ? '/courier/settings' : '/client/settings'));
      }}
    >
      <Settings class="size-4" />
    </Button>
  </div>
</div>
```

**Step 3: Update notification icons**

Update `getNotificationIcon` to include new types:

```typescript
function getNotificationIcon(type: string) {
  switch (type) {
    case 'service_status':
      return CheckCheck;
    case 'new_request':
      return Package;
    case 'schedule_change':
      return CalendarClock;
    case 'past_due':
      return AlertTriangle;
    case 'daily_summary':
      return BarChart3;
    default:
      return Clock;
  }
}
```

**Step 4: Verify**

Run: `pnpm run dev`
Expected: Gear icon in header links to settings

**Step 5: Commit**

```bash
git add src/lib/components/NotificationBell.svelte
git commit -m "feat(dropdown): add settings link and new notification icons"
```

---

## Task 11: Shared Notification Dispatcher

**Files:**
- Create: `supabase/functions/_shared/notify.ts`

**Step 1: Create the shared helper file**

```typescript
// supabase/functions/_shared/notify.ts
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type NotificationCategory =
  | 'new_request'
  | 'schedule_change'
  | 'past_due'
  | 'daily_summary'
  | 'service_status';

type ChannelPreferences = {
  inApp: boolean;
  push: boolean;
  email: boolean;
};

type NotificationPreferences = {
  categories: Record<NotificationCategory, ChannelPreferences>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  workingDaysOnly: boolean;
};

type DispatchResult = {
  inApp: { success: boolean; notificationId?: string; error?: string };
  push: { success: boolean; error?: string } | null;
  email: { success: boolean; error?: string } | null;
};

interface DispatchParams {
  supabase: SupabaseClient;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  serviceId?: string;
  emailTemplate?: string;
  emailData?: Record<string, string>;
}

const DEFAULT_PREFS: NotificationPreferences = {
  categories: {
    new_request: { inApp: true, push: true, email: true },
    schedule_change: { inApp: true, push: true, email: false },
    past_due: { inApp: true, push: true, email: false },
    daily_summary: { inApp: true, push: false, email: true },
    service_status: { inApp: true, push: false, email: true }
  },
  quietHours: { enabled: false, start: '21:00', end: '08:00' },
  workingDaysOnly: true
};

/**
 * Check if current time is within quiet hours.
 * Handles midnight-spanning ranges (e.g., 21:00 to 08:00).
 */
export function isWithinQuietHours(
  now: Date,
  start: string,
  end: string,
  timezone: string
): boolean {
  const localTime = now.toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const [nowHour, nowMin] = localTime.split(':').map(Number);
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);

  const nowMinutes = nowHour * 60 + nowMin;
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    // Midnight-spanning range
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}

function isWorkingDay(now: Date, workingDays: string[], timezone: string): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const localDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const todayName = dayNames[localDate.getDay()];
  return workingDays.includes(todayName);
}

export async function dispatchNotification(params: DispatchParams): Promise<DispatchResult> {
  const { supabase, userId, category, title, message, serviceId, emailTemplate, emailData } = params;
  const now = new Date();

  // Load user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_preferences, timezone, working_days, push_notifications_enabled, email_notifications_enabled')
    .eq('id', userId)
    .single();

  const prefs: NotificationPreferences = profile?.notification_preferences ?? DEFAULT_PREFS;
  const timezone = profile?.timezone || 'Europe/Lisbon';
  const workingDays = profile?.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const categoryPrefs = prefs.categories[category] || { inApp: true, push: false, email: false };

  const result: DispatchResult = {
    inApp: { success: false },
    push: null,
    email: null
  };

  // 1. Always create in-app notification
  const { data: notif, error: notifError } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: category,
      title,
      message,
      service_id: serviceId || null
    })
    .select('id')
    .single();

  if (notifError) {
    result.inApp = { success: false, error: notifError.message };
  } else {
    result.inApp = { success: true, notificationId: notif.id };
  }

  // Check quiet hours and working days
  const isQuiet = prefs.quietHours.enabled &&
    isWithinQuietHours(now, prefs.quietHours.start, prefs.quietHours.end, timezone);
  const isWorking = !prefs.workingDaysOnly || isWorkingDay(now, workingDays, timezone);
  const canSendExternal = !isQuiet && isWorking;

  // 2. Send push if enabled
  if (categoryPrefs.push && profile?.push_notifications_enabled && canSendExternal) {
    try {
      const pushUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`;
      const response = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          user_id: userId,
          title,
          message,
          service_id: serviceId
        })
      });
      const pushResult = await response.json();
      result.push = { success: pushResult.success ?? false, error: pushResult.error };
    } catch (e) {
      result.push = { success: false, error: (e as Error).message };
    }
  }

  // 3. Send email if enabled
  if (categoryPrefs.email && profile?.email_notifications_enabled && canSendExternal && emailTemplate) {
    try {
      const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`;
      const response = await fetch(emailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          user_id: userId,
          template: emailTemplate,
          data: emailData || {}
        })
      });
      const emailResult = await response.json();
      result.email = { success: emailResult.success ?? false, error: emailResult.error };
    } catch (e) {
      result.email = { success: false, error: (e as Error).message };
    }
  }

  return result;
}
```

**Step 2: Commit**

```bash
git add supabase/functions/_shared/
git commit -m "feat(edge): add shared dispatchNotification helper"
```

---

## Task 12: Update check-past-due to Use Dispatcher

**Files:**
- Modify: `supabase/functions/check-past-due/index.ts`

**Step 1: Import dispatcher**

At top of file, add:
```typescript
import { dispatchNotification } from '../_shared/notify.ts';
```

**Step 2: Replace notification insert with dispatcher**

Find the section that inserts notifications (around line 220) and replace:

```typescript
// OLD:
const { error: notifError } = await supabase.from('notifications').insert({
  user_id: courier.id,
  type: 'service_status',
  title: 'Entrega Atrasada',
  message: `Entrega de ${clientName} está ${overdueText} atrasada`,
  service_id: service.id
});

// NEW:
const dispatchResult = await dispatchNotification({
  supabase,
  userId: courier.id,
  category: 'past_due',
  title: 'Entrega Atrasada',
  message: `Entrega de ${clientName} está ${overdueText} atrasada`,
  serviceId: service.id
});

const notifError = dispatchResult.inApp.success ? null : { message: dispatchResult.inApp.error };
```

**Step 3: Deploy and test**

Run: `supabase functions deploy check-past-due`
Expected: Function deploys successfully

**Step 4: Commit**

```bash
git add supabase/functions/check-past-due/
git commit -m "feat(edge): update check-past-due to use notification dispatcher"
```

---

## Task 13: Update daily-summary to Use Dispatcher

**Files:**
- Modify: `supabase/functions/daily-summary/index.ts`

**Step 1: Import dispatcher**

```typescript
import { dispatchNotification } from '../_shared/notify.ts';
```

**Step 2: Replace notification insert**

Find the notification insert (around line 155) and replace:

```typescript
// OLD:
await supabase.from('notifications').insert({
  user_id: courier.id,
  type: 'service_status',
  title: 'Resumo do Dia',
  message,
  service_id: null
});

// NEW:
await dispatchNotification({
  supabase,
  userId: courier.id,
  category: 'daily_summary',
  title: 'Resumo do Dia',
  message,
  serviceId: undefined
});
```

**Step 3: Deploy**

Run: `supabase functions deploy daily-summary`

**Step 4: Commit**

```bash
git add supabase/functions/daily-summary/
git commit -m "feat(edge): update daily-summary to use notification dispatcher"
```

---

## Task 14: Final Testing

**Step 1: Test settings UI**

1. Navigate to `/courier/settings`
2. Toggle push/email for different categories
3. Enable quiet hours, set times
4. Save and refresh - verify persistence

**Step 2: Test notification dropdown**

1. Click bell icon
2. Test tab filtering (All/Requests/Alerts)
3. Test unread filter
4. Verify time grouping
5. Click settings icon - should navigate to settings

**Step 3: Test edge functions**

1. Create test notification via edge function
2. Verify respects category preferences
3. Test quiet hours (set to current time range, verify push/email blocked)

**Step 4: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 5: Run build**

Run: `pnpm run build`
Expected: Build succeeds

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete notification center implementation

- Multi-channel notifications (in-app, push, email)
- Per-category granular preferences
- Quiet hours with midnight-spanning support
- Working days filter
- Enhanced dropdown with tabs, time grouping, settings link
- Shared dispatcher for edge functions"
```

---

## Summary

| Task | Description | Estimated |
|------|-------------|-----------|
| 1 | Database migration | 10 min |
| 2 | TypeScript types | 10 min |
| 3 | Default constants | 5 min |
| 4 | i18n keys | 10 min |
| 5 | Settings UI - Matrix | 20 min |
| 6 | Settings UI - Quiet Hours | 15 min |
| 7 | Server action | 10 min |
| 8 | Dropdown - Tabs | 15 min |
| 9 | Dropdown - Time groups | 15 min |
| 10 | Dropdown - Settings link | 10 min |
| 11 | Shared dispatcher | 20 min |
| 12 | Update check-past-due | 10 min |
| 13 | Update daily-summary | 10 min |
| 14 | Final testing | 20 min |

**Total: ~3 hours**
