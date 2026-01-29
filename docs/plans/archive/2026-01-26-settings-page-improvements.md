# Settings Page Improvements - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the courier settings page into 4 tabs and add new settings for time slots, working days, and timezone.

**Architecture:**
- Refactor 860-line settings page into tabbed interface using shadcn-svelte Tabs component
- Add new fields to `profiles` table: `timezone`, `time_slots`, `working_days`
- Update `past-due.ts` to use custom time slot definitions
- Update Edge Functions to respect timezone and working days

**Tech Stack:** SvelteKit, Svelte 5 runes, shadcn-svelte Tabs, Supabase Edge Functions (Deno)

---

## Task 1: Database Migration for New Settings Fields

**Files:**
- Create: `supabase/migrations/030_add_scheduling_settings.sql`

**Step 1: Write the migration**

```sql
-- Add timezone setting (default: Europe/Lisbon for Portugal)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  timezone text DEFAULT 'Europe/Lisbon';

-- Add time slot definitions as JSONB
-- Structure: { morning: { start, end }, afternoon: { start, end }, evening: { start, end } }
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  time_slots jsonb DEFAULT '{
    "morning": { "start": "08:00", "end": "12:00" },
    "afternoon": { "start": "12:00", "end": "17:00" },
    "evening": { "start": "17:00", "end": "21:00" }
  }'::jsonb;

-- Add working days as JSONB array
-- Structure: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  working_days jsonb DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN profiles.timezone IS 'IANA timezone identifier for the courier (e.g., Europe/Lisbon)';
COMMENT ON COLUMN profiles.time_slots IS 'Custom time slot definitions with start/end times for morning, afternoon, evening';
COMMENT ON COLUMN profiles.working_days IS 'Array of working day names (lowercase)';
```

**Step 2: Apply migration via MCP**

```
mcp__supabase__apply_migration(name: "add_scheduling_settings", query: <SQL above>)
```

**Step 3: Commit**

```bash
git add supabase/migrations/030_add_scheduling_settings.sql
git commit -m "db: Add timezone, time_slots, working_days to profiles"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts`

**Step 1: Add new types for time slots and working days**

After `PastDueSettings` type (around line 28), add:

```typescript
// Time slot configuration for scheduling
export type TimeSlotDefinitions = {
	morning: { start: string; end: string };
	afternoon: { start: string; end: string };
	evening: { start: string; end: string };
};

// Working days configuration
export type WorkingDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
```

**Step 2: Add new fields to profiles Row type**

In `profiles.Row` (after `past_due_settings`), add:

```typescript
// Scheduling settings (Phase 6 Settings)
timezone: string;
time_slots: TimeSlotDefinitions | null;
working_days: WorkingDay[] | null;
```

**Step 3: Add to Insert and Update types**

```typescript
// In Insert:
timezone?: string;
time_slots?: TimeSlotDefinitions | null;
working_days?: WorkingDay[] | null;

// In Update:
timezone?: string;
time_slots?: TimeSlotDefinitions | null;
working_days?: WorkingDay[] | null;
```

**Step 4: Verify type check passes**

```bash
pnpm run check
```

**Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "types: Add timezone, time_slots, working_days to Profile"
```

---

## Task 3: Update past-due.ts to Accept Custom Time Slots [COMPLETE]

**Files:**
- Modify: `src/lib/utils/past-due.ts`
- Modify: `src/routes/courier/+layout.server.ts` (added `time_slots` to returned profile)

**Step 1: Update settingsToConfig to accept time slots**

Change the function signature and implementation:

```typescript
/**
 * Convert database PastDueSettings to PastDueConfig for calculations.
 * Now accepts optional custom time slots from profile settings.
 */
export function settingsToConfig(
	settings: {
		gracePeriodStandard?: number;
		gracePeriodSpecific?: number;
		thresholdApproaching?: number;
		thresholdUrgent?: number;
		thresholdCriticalHours?: number;
	} | null,
	timeSlots?: TimeSlotConfig | null
): PastDueConfig {
	if (!settings) return DEFAULT_CONFIG;

	return {
		timeSlots: timeSlots ?? DEFAULT_CONFIG.timeSlots,
		gracePeriodStandard: settings.gracePeriodStandard ?? DEFAULT_CONFIG.gracePeriodStandard,
		gracePeriodSpecific: settings.gracePeriodSpecific ?? DEFAULT_CONFIG.gracePeriodSpecific,
		thresholdApproaching: settings.thresholdApproaching ?? DEFAULT_CONFIG.thresholdApproaching,
		thresholdUrgent: settings.thresholdUrgent ?? DEFAULT_CONFIG.thresholdUrgent,
		thresholdCriticalHours: settings.thresholdCriticalHours ?? DEFAULT_CONFIG.thresholdCriticalHours
	};
}
```

**Step 2: Update usages in dashboard and services list**

In `src/routes/courier/+page.svelte` and `src/routes/courier/services/+page.svelte`, update calls:

```typescript
// Before:
const config = settingsToConfig(data.profile.past_due_settings);

// After:
const config = settingsToConfig(data.profile.past_due_settings, data.profile.time_slots);
```

**Step 3: Commit**

```bash
git add src/lib/utils/past-due.ts src/routes/courier/+page.svelte src/routes/courier/services/+page.svelte
git commit -m "feat(past-due): Support custom time slot definitions"
```

---

## Task 4: Add shadcn-svelte Tabs Component

**Step 1: Install the Tabs component**

```bash
pnpm dlx shadcn-svelte@latest add tabs --yes
```

**Step 2: Verify installation**

Check that `src/lib/components/ui/tabs/` directory exists.

**Step 3: Commit**

```bash
git add src/lib/components/ui/tabs
git commit -m "chore: Add shadcn-svelte Tabs component"
```

---

## Task 5: Add Translations for New Settings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English translations**

```json
"settings_tab_account": "Account",
"settings_tab_pricing": "Pricing",
"settings_tab_scheduling": "Scheduling",
"settings_tab_notifications": "Notifications",
"settings_time_slots": "Time Slot Definitions",
"settings_time_slots_desc": "Define when each delivery time slot starts and ends",
"settings_time_slot_morning": "Morning",
"settings_time_slot_afternoon": "Afternoon",
"settings_time_slot_evening": "Evening",
"settings_time_slot_start": "Start",
"settings_time_slot_end": "End",
"settings_working_days": "Working Days",
"settings_working_days_desc": "Select which days you work",
"day_monday": "Monday",
"day_tuesday": "Tuesday",
"day_wednesday": "Wednesday",
"day_thursday": "Thursday",
"day_friday": "Friday",
"day_saturday": "Saturday",
"day_sunday": "Sunday",
"settings_timezone": "Timezone",
"settings_timezone_desc": "Your local timezone for notifications and scheduling"
```

**Step 2: Add Portuguese translations**

```json
"settings_tab_account": "Conta",
"settings_tab_pricing": "Preços",
"settings_tab_scheduling": "Agendamento",
"settings_tab_notifications": "Notificações",
"settings_time_slots": "Horários dos Períodos",
"settings_time_slots_desc": "Defina quando cada período de entrega começa e termina",
"settings_time_slot_morning": "Manhã",
"settings_time_slot_afternoon": "Tarde",
"settings_time_slot_evening": "Noite",
"settings_time_slot_start": "Início",
"settings_time_slot_end": "Fim",
"settings_working_days": "Dias de Trabalho",
"settings_working_days_desc": "Selecione os dias em que trabalha",
"day_monday": "Segunda",
"day_tuesday": "Terça",
"day_wednesday": "Quarta",
"day_thursday": "Quinta",
"day_friday": "Sexta",
"day_saturday": "Sábado",
"day_sunday": "Domingo",
"settings_timezone": "Fuso Horário",
"settings_timezone_desc": "O seu fuso horário local para notificações e agendamento"
```

**Step 3: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "i18n: Add translations for settings tabs and new options"
```

---

## Task 6: Create Settings Tab Components

**Files:**
- Create: `src/routes/courier/settings/AccountTab.svelte`
- Create: `src/routes/courier/settings/PricingTab.svelte`
- Create: `src/routes/courier/settings/SchedulingTab.svelte`
- Create: `src/routes/courier/settings/NotificationsTab.svelte`

**Step 1: Create AccountTab.svelte**

Extract Profile and Default Location cards from main page:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import { User, Warehouse } from '@lucide/svelte';
	import type { Profile } from '$lib/database.types.js';

	interface Props {
		profile: Profile;
		sessionEmail: string;
		warehouseAddress: string;
		warehouseCoords: [number, number] | null;
		onWarehouseChange: (address: string, coords: [number, number] | null) => void;
	}

	let { profile, sessionEmail, warehouseAddress, warehouseCoords, onWarehouseChange }: Props = $props();
</script>

<!-- Profile Settings Card -->
<Card.Root>
	<!-- ... existing Profile card content ... -->
</Card.Root>

<!-- Default Location Card -->
<Card.Root class="mt-6">
	<!-- ... existing Default Location card content ... -->
</Card.Root>
```

**Step 2: Create PricingTab.svelte**

Extract Pricing Mode, Pricing Preferences, and Urgency Fees cards.

**Step 3: Create SchedulingTab.svelte**

Extract Delivery Deadlines and Client Rescheduling cards, plus add new:
- Time Slot Definitions card
- Working Days card

**Step 4: Create NotificationsTab.svelte**

Extract Notification Preferences and Automated Notifications cards, plus add:
- Timezone selector

**Step 5: Commit**

```bash
git add src/routes/courier/settings/*.svelte
git commit -m "feat(settings): Create tab components for settings page"
```

---

## Task 7: Refactor Main Settings Page to Use Tabs

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte`

**Step 1: Replace Card-based layout with Tabs**

```svelte
<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import AccountTab from './AccountTab.svelte';
	import PricingTab from './PricingTab.svelte';
	import SchedulingTab from './SchedulingTab.svelte';
	import NotificationsTab from './NotificationsTab.svelte';
	// ... existing imports ...
</script>

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<Settings class="size-6" />
		<h1 class="text-2xl font-bold">{m.settings_title()}</h1>
	</div>

	{#if form?.error}
		<!-- error display -->
	{/if}

	{#if form?.success}
		<!-- success display -->
	{/if}

	<Tabs.Root value="account" class="w-full">
		<Tabs.List class="grid w-full grid-cols-4">
			<Tabs.Trigger value="account">{m.settings_tab_account()}</Tabs.Trigger>
			<Tabs.Trigger value="pricing">{m.settings_tab_pricing()}</Tabs.Trigger>
			<Tabs.Trigger value="scheduling">{m.settings_tab_scheduling()}</Tabs.Trigger>
			<Tabs.Trigger value="notifications">{m.settings_tab_notifications()}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="account" class="mt-6">
			<AccountTab {profile} {sessionEmail} ... />
		</Tabs.Content>

		<Tabs.Content value="pricing" class="mt-6">
			<PricingTab ... />
		</Tabs.Content>

		<Tabs.Content value="scheduling" class="mt-6">
			<SchedulingTab ... />
		</Tabs.Content>

		<Tabs.Content value="notifications" class="mt-6">
			<NotificationsTab ... />
		</Tabs.Content>
	</Tabs.Root>
</div>
```

**Step 2: Move state to appropriate tabs or keep shared**

**Step 3: Verify type check passes**

```bash
pnpm run check
```

**Step 4: Commit**

```bash
git add src/routes/courier/settings/+page.svelte
git commit -m "feat(settings): Refactor to tabbed interface"
```

---

## Task 8: Add Server Actions for New Settings

**Files:**
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Add updateTimeSlots action**

```typescript
updateTimeSlots: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return { success: false, error: 'Not authenticated' };

	const formData = await request.formData();
	const timeSlots = {
		morning: {
			start: formData.get('morning_start') as string,
			end: formData.get('morning_end') as string
		},
		afternoon: {
			start: formData.get('afternoon_start') as string,
			end: formData.get('afternoon_end') as string
		},
		evening: {
			start: formData.get('evening_start') as string,
			end: formData.get('evening_end') as string
		}
	};

	const { error } = await supabase
		.from('profiles')
		.update({ time_slots: timeSlots })
		.eq('id', user.id);

	if (error) return { success: false, error: error.message };
	return { success: true };
}
```

**Step 2: Add updateWorkingDays action**

```typescript
updateWorkingDays: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return { success: false, error: 'Not authenticated' };

	const formData = await request.formData();
	const workingDays = formData.getAll('working_days') as string[];

	const { error } = await supabase
		.from('profiles')
		.update({ working_days: workingDays })
		.eq('id', user.id);

	if (error) return { success: false, error: error.message };
	return { success: true };
}
```

**Step 3: Add updateTimezone action**

```typescript
updateTimezone: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return { success: false, error: 'Not authenticated' };

	const formData = await request.formData();
	const timezone = formData.get('timezone') as string;

	const { error } = await supabase
		.from('profiles')
		.update({ timezone })
		.eq('id', user.id);

	if (error) return { success: false, error: error.message };
	return { success: true };
}
```

**Step 4: Commit**

```bash
git add src/routes/courier/settings/+page.server.ts
git commit -m "feat(settings): Add server actions for time slots, working days, timezone"
```

---

## Task 9: Update Edge Functions for Timezone Support

**Files:**
- Modify: `supabase/functions/check-past-due/index.ts`
- Modify: `supabase/functions/daily-summary/index.ts`

**Step 1: Update check-past-due to use custom time slots**

Add `time_slots` to the profile query and use in calculations:

```typescript
const { data: courierData } = await supabase
	.from('profiles')
	.select('id, past_due_settings, time_slots, working_days, timezone')
	.eq('role', 'courier')
	.single();

// Check if today is a working day
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const todayName = dayNames[now.getDay()];
const workingDays = courier.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

if (!workingDays.includes(todayName)) {
	return new Response(JSON.stringify({ message: 'Not a working day', notified: 0 }), ...);
}

// Use custom time slots if defined
const timeSlots = courier.time_slots || TIME_SLOT_CUTOFFS;
```

**Step 2: Update daily-summary for timezone**

```typescript
// Get courier's timezone
const courierTimezone = courier.timezone || 'Europe/Lisbon';
const preferredTime = settings.dailySummaryTime || '08:00';

// Get current local time in courier's timezone
const localTime = now.toLocaleTimeString('en-GB', {
	timeZone: courierTimezone,
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});

// Only send if within the right 15-minute window
const [prefHour, prefMin] = preferredTime.split(':').map(Number);
const [localHour, localMin] = localTime.split(':').map(Number);

if (localHour !== prefHour || Math.abs(localMin - prefMin) > 7) {
	return new Response(JSON.stringify({ message: 'Not the right time', sent: false }), ...);
}

// Check if today is a working day
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const localDate = new Date(now.toLocaleString('en-US', { timeZone: courierTimezone }));
const todayName = dayNames[localDate.getDay()];
const workingDays = courier.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

if (!workingDays.includes(todayName)) {
	return new Response(JSON.stringify({ message: 'Not a working day', sent: false }), ...);
}
```

**Step 3: Deploy updated Edge Functions**

```bash
mcp__supabase__deploy_edge_function(name: "check-past-due", ...)
mcp__supabase__deploy_edge_function(name: "daily-summary", ...)
```

**Step 4: Commit**

```bash
git add supabase/functions/check-past-due/index.ts supabase/functions/daily-summary/index.ts
git commit -m "feat(edge): Add timezone, time slots, working days support"
```

---

## Task 10: Final Verification

**Step 1: Run type check**

```bash
pnpm run check
```

Expected: 0 errors

**Step 2: Verify Edge Functions deployed**

```bash
mcp__supabase__list_edge_functions()
```

**Step 3: Run security advisor**

```bash
mcp__supabase__get_advisors(type: "security")
```

**Step 4: Manual testing checklist**

- [ ] Settings page loads with 4 tabs
- [ ] Account tab: Profile and warehouse location work
- [ ] Pricing tab: All pricing settings work
- [ ] Scheduling tab: Time slots, working days, deadlines all save
- [ ] Notifications tab: All notification settings + timezone work
- [ ] Urgency badges reflect custom time slot definitions
- [ ] Daily summary respects timezone setting
- [ ] Past due check respects working days

**Step 5: Final commit**

```bash
git add -A
git commit -m "docs: Mark settings page improvements complete"
```

---

# Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `migrations/030_*.sql` |
| 2 | TypeScript types | `database.types.ts` |
| 3 | Update past-due.ts | `past-due.ts`, dashboard, services |
| 4 | Add Tabs component | shadcn-svelte |
| 5 | Translations | `messages/*.json` |
| 6 | Create tab components | 4 new `*Tab.svelte` files |
| 7 | Refactor main page | `settings/+page.svelte` |
| 8 | Server actions | `settings/+page.server.ts` |
| 9 | Edge Functions | `check-past-due`, `daily-summary` |
| 10 | Verification | Testing |

**Parallel opportunities:**
- Tasks 1-5 can run in parallel (no dependencies)
- Tasks 6-7 are sequential (7 depends on 6)
- Task 8 can run parallel to 6-7
- Task 9 depends on 1-2 (needs types)
- Task 10 is final verification

**Estimated total:** ~4-6 hours of implementation
