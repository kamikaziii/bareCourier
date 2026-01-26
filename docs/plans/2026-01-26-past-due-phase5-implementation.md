# Phase 5: Advanced Features - Implementation Plan

> **Status:** Complete (2026-01-26)
>
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add batch reschedule operations and automated past-due/daily summary notifications to help the courier manage deliveries proactively.

**Architecture:**
- Batch reschedule adds multi-select UI to dashboard with a shared reschedule dialog
- Past due notifications use a Supabase Edge Function triggered by pg_cron every 15 minutes
- Daily summary uses another Edge Function triggered once per day at configurable time
- All notifications respect courier's preference settings stored in `past_due_settings` JSONB

**Tech Stack:** SvelteKit, Svelte 5 runes, Supabase Edge Functions (Deno), pg_cron, pg_net, shadcn-svelte

---

## Task 1: Add Notification Settings to PastDueSettings Type

**Files:**
- Modify: `src/lib/database.types.ts:15-24`

**Step 1: Update PastDueSettings type**

Add notification-related fields to the existing type:

```typescript
// Phase 3 Past Due: Configurable settings
export type PastDueSettings = {
	gracePeriodStandard: number; // minutes after slot end (default: 30)
	gracePeriodSpecific: number; // minutes after specific time (default: 15)
	thresholdApproaching: number; // minutes before deadline to show "approaching" (default: 120)
	thresholdUrgent: number; // minutes before deadline to show "urgent" (default: 60)
	thresholdCriticalHours: number; // hours after past due to show "critical" (default: 24)
	allowClientReschedule: boolean; // whether clients can request reschedules
	clientMinNoticeHours: number; // minimum hours notice for client reschedule
	clientMaxReschedules: number; // maximum reschedules per service
	// Phase 5: Notification settings
	pastDueReminderInterval: number; // minutes between reminders (0 = disabled, default: 60)
	dailySummaryEnabled: boolean; // whether to send daily summary (default: true)
	dailySummaryTime: string; // time to send daily summary HH:MM (default: "08:00")
};
```

**Step 2: Verify type check passes**

Run: `pnpm run check`
Expected: 0 errors, 0 warnings

**Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "types: Add Phase 5 notification settings to PastDueSettings"
```

---

## Task 2: Update Default Settings and Settings UI

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte:68-81`
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Update default settings in +page.svelte**

Find the `defaultPastDueSettings` object (around line 68) and add the new fields:

```typescript
const defaultPastDueSettings: PastDueSettings = {
	gracePeriodStandard: 30,
	gracePeriodSpecific: 15,
	thresholdApproaching: 120,
	thresholdUrgent: 60,
	thresholdCriticalHours: 24,
	allowClientReschedule: true,
	clientMinNoticeHours: 24,
	clientMaxReschedules: 3,
	// Phase 5 defaults
	pastDueReminderInterval: 60,
	dailySummaryEnabled: true,
	dailySummaryTime: '08:00'
};
```

**Step 2: Add UI controls for notification settings**

After the "Client Rescheduling" section in the settings page, add a new "Automated Notifications" section:

```svelte
<!-- Automated Notifications Section -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Bell class="size-5" />
			{m.settings_automated_notifications()}
		</Card.Title>
		<Card.Description>{m.settings_automated_notifications_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updateNotificationSettings" use:enhance class="space-y-6">
			<!-- Past Due Reminder Interval -->
			<div class="space-y-2">
				<Label for="pastDueReminderInterval">{m.settings_past_due_reminder_interval()}</Label>
				<select
					id="pastDueReminderInterval"
					name="pastDueReminderInterval"
					class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					value={pastDueSettings.pastDueReminderInterval}
				>
					<option value="0">{m.settings_reminder_disabled()}</option>
					<option value="15">15 {m.minutes()}</option>
					<option value="30">30 {m.minutes()}</option>
					<option value="60">1 {m.hour()}</option>
					<option value="120">2 {m.hours()}</option>
				</select>
				<p class="text-xs text-muted-foreground">{m.settings_past_due_reminder_interval_desc()}</p>
			</div>

			<Separator />

			<!-- Daily Summary -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<Label>{m.settings_daily_summary()}</Label>
						<p class="text-xs text-muted-foreground">{m.settings_daily_summary_desc()}</p>
					</div>
					<Switch
						name="dailySummaryEnabled"
						checked={pastDueSettings.dailySummaryEnabled}
						onCheckedChange={(checked) => (pastDueSettings.dailySummaryEnabled = checked)}
					/>
				</div>

				{#if pastDueSettings.dailySummaryEnabled}
					<div class="space-y-2">
						<Label for="dailySummaryTime">{m.settings_daily_summary_time()}</Label>
						<Input
							id="dailySummaryTime"
							name="dailySummaryTime"
							type="time"
							value={pastDueSettings.dailySummaryTime}
							class="w-32"
						/>
					</div>
				{/if}
			</div>

			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>
```

**Step 3: Add server action for notification settings**

In `+page.server.ts`, add a new action (after `updateClientRescheduleSettings`):

```typescript
updateNotificationSettings: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) return { success: false, error: 'Not authenticated' };

	const formData = await request.formData();
	const pastDueReminderInterval = parseInt(formData.get('pastDueReminderInterval') as string) || 0;
	const dailySummaryEnabled = formData.get('dailySummaryEnabled') === 'on';
	const dailySummaryTime = (formData.get('dailySummaryTime') as string) || '08:00';

	// Get current settings
	const { data: profile } = await supabase
		.from('profiles')
		.select('past_due_settings')
		.eq('id', user.id)
		.single();

	const currentSettings = (profile?.past_due_settings as PastDueSettings) || {};

	// Merge with new notification settings
	const updatedSettings: PastDueSettings = {
		...currentSettings,
		pastDueReminderInterval,
		dailySummaryEnabled,
		dailySummaryTime
	};

	const { error } = await supabase
		.from('profiles')
		.update({ past_due_settings: updatedSettings })
		.eq('id', user.id);

	if (error) return { success: false, error: error.message };
	return { success: true };
}
```

**Step 4: Commit**

```bash
git add src/routes/courier/settings/+page.svelte src/routes/courier/settings/+page.server.ts
git commit -m "feat(settings): Add Phase 5 notification settings UI"
```

---

## Task 3: Add Translations for Phase 5

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English translations**

Add after the Phase 4 reschedule translations (around line 465):

```json
,
"settings_automated_notifications": "Automated Notifications",
"settings_automated_notifications_desc": "Configure automatic reminders and daily summaries",
"settings_past_due_reminder_interval": "Past Due Reminder Interval",
"settings_past_due_reminder_interval_desc": "How often to send reminders for past due deliveries",
"settings_reminder_disabled": "Disabled",
"settings_daily_summary": "Daily Summary",
"settings_daily_summary_desc": "Receive a morning summary of today's deliveries",
"settings_daily_summary_time": "Summary Time",
"minutes": "minutes",
"hour": "hour",
"hours": "hours",
"batch_reschedule": "Reschedule Selected",
"batch_reschedule_desc": "Move {count} services to a new date",
"batch_select_all": "Select All",
"batch_deselect_all": "Deselect All",
"batch_selected_count": "{count} selected",
"notification_past_due_title": "Delivery Past Due",
"notification_past_due_body": "{clientName} delivery is {time} overdue",
"notification_daily_summary_title": "Today's Deliveries",
"notification_daily_summary_body": "You have {total} deliveries today: {pending} pending, {urgent} urgent"
```

**Step 2: Add Portuguese translations**

```json
,
"settings_automated_notifications": "Notificações Automáticas",
"settings_automated_notifications_desc": "Configure lembretes automáticos e resumos diários",
"settings_past_due_reminder_interval": "Intervalo de Lembrete de Atrasos",
"settings_past_due_reminder_interval_desc": "Com que frequência enviar lembretes para entregas atrasadas",
"settings_reminder_disabled": "Desativado",
"settings_daily_summary": "Resumo Diário",
"settings_daily_summary_desc": "Receba um resumo matinal das entregas de hoje",
"settings_daily_summary_time": "Hora do Resumo",
"minutes": "minutos",
"hour": "hora",
"hours": "horas",
"batch_reschedule": "Reagendar Selecionados",
"batch_reschedule_desc": "Mover {count} serviços para uma nova data",
"batch_select_all": "Selecionar Todos",
"batch_deselect_all": "Desselecionar Todos",
"batch_selected_count": "{count} selecionados",
"notification_past_due_title": "Entrega Atrasada",
"notification_past_due_body": "Entrega de {clientName} está {time} atrasada",
"notification_daily_summary_title": "Entregas de Hoje",
"notification_daily_summary_body": "Tem {total} entregas hoje: {pending} pendentes, {urgent} urgentes"
```

**Step 3: Regenerate Paraglide messages**

```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide
```

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "i18n: Add Phase 5 batch reschedule and notification translations"
```

---

## Task 4: Add Batch Selection to Courier Dashboard

**Files:**
- Modify: `src/routes/courier/+page.svelte`

**Step 1: Add selection state and helpers**

After the existing state declarations (around line 28), add:

```typescript
// Batch selection state
let selectionMode = $state(false);
let selectedIds = $state<Set<string>>(new Set());

function toggleSelectionMode() {
	selectionMode = !selectionMode;
	if (!selectionMode) {
		selectedIds = new Set();
	}
}

function toggleServiceSelection(serviceId: string) {
	const newSet = new Set(selectedIds);
	if (newSet.has(serviceId)) {
		newSet.delete(serviceId);
	} else {
		newSet.add(serviceId);
	}
	selectedIds = newSet;
}

function selectAllVisible() {
	const pendingServices = sortedServices.filter(s => s.status === 'pending');
	selectedIds = new Set(pendingServices.map(s => s.id));
}

function deselectAll() {
	selectedIds = new Set();
}

const selectedCount = $derived(selectedIds.size);
const hasSelection = $derived(selectedCount > 0);
```

**Step 2: Add derived for sorted services**

```typescript
const sortedServices = $derived(sortByUrgency(services, pastDueConfig));
```

**Step 3: Add batch reschedule dialog state**

```typescript
// Batch reschedule dialog
let showBatchRescheduleDialog = $state(false);
let batchRescheduleDate = $state<string | null>(null);
let batchRescheduleTimeSlot = $state<TimeSlot | null>(null);
let batchRescheduleTime = $state<string | null>(null);
let batchRescheduleReason = $state('');
let batchRescheduleLoading = $state(false);

function openBatchRescheduleDialog() {
	batchRescheduleDate = null;
	batchRescheduleTimeSlot = null;
	batchRescheduleTime = null;
	batchRescheduleReason = '';
	showBatchRescheduleDialog = true;
}
```

**Step 4: Add imports**

Add to imports:

```typescript
import * as Dialog from '$lib/components/ui/dialog/index.js';
import { Checkbox } from '$lib/components/ui/checkbox/index.js';
import { Textarea } from '$lib/components/ui/textarea/index.js';
import { Label } from '$lib/components/ui/label/index.js';
import SchedulePicker from '$lib/components/SchedulePicker.svelte';
import { CalendarClock, CheckSquare } from '@lucide-svelte';
import type { TimeSlot } from '$lib/database.types.js';
```

**Step 5: Add selection toolbar UI**

After the filter buttons section, add:

```svelte
<!-- Selection Mode Toolbar -->
<div class="flex items-center gap-2 flex-wrap">
	<Button
		variant={selectionMode ? 'default' : 'outline'}
		size="sm"
		onclick={toggleSelectionMode}
	>
		<CheckSquare class="size-4 mr-1" />
		{selectionMode ? m.batch_deselect_all() : m.batch_select_all()}
	</Button>

	{#if selectionMode && hasSelection}
		<span class="text-sm text-muted-foreground">
			{m.batch_selected_count({ count: selectedCount })}
		</span>
		<Button size="sm" onclick={openBatchRescheduleDialog}>
			<CalendarClock class="size-4 mr-1" />
			{m.batch_reschedule()}
		</Button>
		<Button size="sm" variant="ghost" onclick={deselectAll}>
			{m.batch_deselect_all()}
		</Button>
	{/if}
</div>
```

**Step 6: Add checkbox to service cards**

In the service card rendering, wrap content with selection checkbox when in selection mode:

```svelte
{#each sortedServices as service (service.id)}
	<a
		href={selectionMode ? undefined : localizeHref(`/courier/services/${service.id}`)}
		class="block"
		onclick={(e) => {
			if (selectionMode && service.status === 'pending') {
				e.preventDefault();
				toggleServiceSelection(service.id);
			}
		}}
	>
		<Card.Root class={selectedIds.has(service.id) ? 'ring-2 ring-primary' : ''}>
			<Card.Content class="pt-6">
				<div class="flex gap-3">
					{#if selectionMode && service.status === 'pending'}
						<Checkbox
							checked={selectedIds.has(service.id)}
							onCheckedChange={() => toggleServiceSelection(service.id)}
							class="mt-1"
						/>
					{/if}
					<!-- existing card content -->
				</div>
			</Card.Content>
		</Card.Root>
	</a>
{/each}
```

**Step 7: Commit**

```bash
git add src/routes/courier/+page.svelte
git commit -m "feat(batch): Add selection mode to courier dashboard"
```

---

## Task 5: Add Batch Reschedule Server Action

**Files:**
- Modify: `src/routes/courier/+page.server.ts`

**Step 1: Create or update the file with batch reschedule action**

```typescript
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import type { Service } from '$lib/database.types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}
	return {};
};

// Helper to send notification
async function notifyClient(
	session: { access_token: string },
	clientId: string,
	serviceId: string,
	subject: string,
	message: string
) {
	try {
		await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${session.access_token}`,
				'apikey': PUBLIC_SUPABASE_ANON_KEY
			},
			body: JSON.stringify({
				type: 'both',
				user_id: clientId,
				subject,
				message,
				service_id: serviceId,
				url: `/client/services/${serviceId}`
			})
		});
	} catch (error) {
		console.error('Notification error:', error);
	}
}

export const actions: Actions = {
	batchReschedule: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify user is courier
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if ((profile as { role: string } | null)?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const serviceIds = JSON.parse(formData.get('service_ids') as string) as string[];
		const newDate = formData.get('date') as string;
		const newTimeSlot = formData.get('time_slot') as string;
		const newTime = formData.get('time') as string | null;
		const reason = formData.get('reason') as string;

		if (!serviceIds || serviceIds.length === 0) {
			return { success: false, error: 'No services selected' };
		}

		if (!newDate || !newTimeSlot) {
			return { success: false, error: 'Date and time slot required' };
		}

		// Get all selected services
		const { data: services } = await supabase
			.from('services')
			.select('id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, reschedule_count, status')
			.in('id', serviceIds)
			.eq('status', 'pending');

		if (!services || services.length === 0) {
			return { success: false, error: 'No pending services found' };
		}

		const results: { success: number; failed: number } = { success: 0, failed: 0 };
		const clientNotifications: Map<string, string[]> = new Map();

		for (const service of services as Service[]) {
			// Update service
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { error: updateError } = await (supabase as any)
				.from('services')
				.update({
					scheduled_date: newDate,
					scheduled_time_slot: newTimeSlot,
					scheduled_time: newTime || null,
					reschedule_count: (service.reschedule_count || 0) + 1,
					last_rescheduled_at: new Date().toISOString(),
					last_rescheduled_by: user.id
				})
				.eq('id', service.id);

			if (updateError) {
				results.failed++;
				continue;
			}

			// Create history record
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (supabase as any).from('service_reschedule_history').insert({
				service_id: service.id,
				initiated_by: user.id,
				initiated_by_role: 'courier',
				old_date: service.scheduled_date,
				old_time_slot: service.scheduled_time_slot,
				old_time: service.scheduled_time,
				new_date: newDate,
				new_time_slot: newTimeSlot,
				new_time: newTime || null,
				reason: reason || 'Batch reschedule',
				approval_status: 'auto_approved'
			});

			results.success++;

			// Group notifications by client
			const clientServices = clientNotifications.get(service.client_id) || [];
			clientServices.push(service.id);
			clientNotifications.set(service.client_id, clientServices);
		}

		// Send grouped notifications to clients
		const formattedDate = new Date(newDate).toLocaleDateString('pt-PT', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		for (const [clientId, serviceIdList] of clientNotifications) {
			const count = serviceIdList.length;
			const message = count === 1
				? `A sua entrega foi reagendada para ${formattedDate}.`
				: `${count} entregas foram reagendadas para ${formattedDate}.`;

			await notifyClient(
				session,
				clientId,
				serviceIdList[0], // Link to first service
				'Entregas Reagendadas',
				message
			);
		}

		return { success: true, results };
	}
};
```

**Step 2: Commit**

```bash
git add src/routes/courier/+page.server.ts
git commit -m "feat(batch): Add batch reschedule server action"
```

---

## Task 6: Add Batch Reschedule Dialog UI

**Files:**
- Modify: `src/routes/courier/+page.svelte`

**Step 1: Add the batch reschedule handler function**

```typescript
async function handleBatchReschedule() {
	if (!batchRescheduleDate || !batchRescheduleTimeSlot || selectedIds.size === 0) return;

	batchRescheduleLoading = true;

	const formData = new FormData();
	formData.set('service_ids', JSON.stringify(Array.from(selectedIds)));
	formData.set('date', batchRescheduleDate);
	formData.set('time_slot', batchRescheduleTimeSlot);
	if (batchRescheduleTime) formData.set('time', batchRescheduleTime);
	formData.set('reason', batchRescheduleReason);

	try {
		const response = await fetch('?/batchReschedule', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();
		if (result.data?.success) {
			await loadServices();
			showBatchRescheduleDialog = false;
			selectionMode = false;
			selectedIds = new Set();
		}
	} catch (error) {
		console.error('Batch reschedule error:', error);
	}

	batchRescheduleLoading = false;
}
```

**Step 2: Add the dialog component at end of template**

```svelte
<!-- Batch Reschedule Dialog -->
<Dialog.Root bind:open={showBatchRescheduleDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<CalendarClock class="size-5" />
				{m.batch_reschedule()}
			</Dialog.Title>
			<Dialog.Description>
				{m.batch_reschedule_desc({ count: selectedCount })}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<SchedulePicker
				selectedDate={batchRescheduleDate}
				selectedTimeSlot={batchRescheduleTimeSlot}
				selectedTime={batchRescheduleTime}
				onDateChange={(date) => (batchRescheduleDate = date)}
				onTimeSlotChange={(slot) => (batchRescheduleTimeSlot = slot)}
				onTimeChange={(time) => (batchRescheduleTime = time)}
			/>

			<div class="space-y-2">
				<Label for="batch-reason">{m.reschedule_reason()}</Label>
				<Textarea
					id="batch-reason"
					bind:value={batchRescheduleReason}
					placeholder={m.reschedule_reason_placeholder()}
					rows={2}
				/>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showBatchRescheduleDialog = false)} disabled={batchRescheduleLoading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleBatchReschedule} disabled={!batchRescheduleDate || !batchRescheduleTimeSlot || batchRescheduleLoading}>
				{batchRescheduleLoading ? m.saving() : m.batch_reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
```

**Step 3: Verify type check passes**

Run: `pnpm run check`
Expected: 0 errors, 0 warnings

**Step 4: Commit**

```bash
git add src/routes/courier/+page.svelte
git commit -m "feat(batch): Add batch reschedule dialog UI"
```

---

## Task 7: Create Past Due Check Edge Function

**Files:**
- Create: `supabase/functions/check-past-due/index.ts`

**Step 1: Create the Edge Function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Time slot cutoffs
const TIME_SLOT_CUTOFFS: Record<string, string> = {
  morning: "12:00",
  afternoon: "17:00",
  evening: "21:00",
};

interface Service {
  id: string;
  client_id: string;
  scheduled_date: string;
  scheduled_time_slot: string | null;
  scheduled_time: string | null;
  status: string;
  profiles: { name: string } | null;
}

interface PastDueSettings {
  gracePeriodStandard?: number;
  gracePeriodSpecific?: number;
  pastDueReminderInterval?: number;
}

interface CourierProfile {
  id: string;
  past_due_settings: PastDueSettings | null;
}

// Track last notification time per service to prevent spam
const notificationCache: Map<string, number> = new Map();

function getCutoffTime(service: Service, gracePeriod: number): Date | null {
  if (!service.scheduled_date) return null;

  const date = new Date(service.scheduled_date + "T00:00:00");

  if (service.scheduled_time_slot === "specific" && service.scheduled_time) {
    const [hours, minutes] = service.scheduled_time.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
  } else if (service.scheduled_time_slot && TIME_SLOT_CUTOFFS[service.scheduled_time_slot]) {
    const [hours, minutes] = TIME_SLOT_CUTOFFS[service.scheduled_time_slot].split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
  } else {
    // Default to end of day
    date.setHours(17, 0, 0, 0);
  }

  // Add grace period
  return new Date(date.getTime() + gracePeriod * 60 * 1000);
}

function formatOverdueTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutos`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hora${hours > 1 ? "s" : ""}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} dia${days > 1 ? "s" : ""}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Get courier profile with settings
    const { data: courierData } = await supabase
      .from("profiles")
      .select("id, past_due_settings")
      .eq("role", "courier")
      .single();

    const courier = courierData as CourierProfile | null;
    if (!courier) {
      return new Response(
        JSON.stringify({ error: "Courier not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = courier.past_due_settings || {};
    const reminderInterval = settings.pastDueReminderInterval ?? 60;

    // If reminders disabled, exit
    if (reminderInterval === 0) {
      return new Response(
        JSON.stringify({ message: "Reminders disabled", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gracePeriodStandard = settings.gracePeriodStandard ?? 30;
    const gracePeriodSpecific = settings.gracePeriodSpecific ?? 15;

    // Get pending services scheduled for today or earlier
    const todayStr = now.toISOString().split("T")[0];
    const { data: services } = await supabase
      .from("services")
      .select("id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status, profiles!client_id(name)")
      .eq("status", "pending")
      .lte("scheduled_date", todayStr)
      .is("deleted_at", null);

    if (!services || services.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending services", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pastDueServices: { service: Service; overdueMinutes: number }[] = [];

    for (const service of services as Service[]) {
      const gracePeriod = service.scheduled_time_slot === "specific"
        ? gracePeriodSpecific
        : gracePeriodStandard;

      const cutoff = getCutoffTime(service, gracePeriod);
      if (!cutoff) continue;

      if (now > cutoff) {
        const overdueMinutes = (now.getTime() - cutoff.getTime()) / (1000 * 60);

        // Check if we've notified recently
        const lastNotified = notificationCache.get(service.id) || 0;
        const minutesSinceLastNotification = (now.getTime() - lastNotified) / (1000 * 60);

        if (minutesSinceLastNotification >= reminderInterval) {
          pastDueServices.push({ service, overdueMinutes });
        }
      }
    }

    // Send notifications for past due services
    let notifiedCount = 0;

    for (const { service, overdueMinutes } of pastDueServices) {
      const clientName = service.profiles?.name || "Cliente";
      const overdueText = formatOverdueTime(overdueMinutes);

      // Create in-app notification for courier
      await supabase.from("notifications").insert({
        user_id: courier.id,
        type: "service_status",
        title: "Entrega Atrasada",
        message: `Entrega de ${clientName} está ${overdueText} atrasada`,
        service_id: service.id,
      });

      // Update cache
      notificationCache.set(service.id, now.getTime());
      notifiedCount++;
    }

    return new Response(
      JSON.stringify({
        message: "Past due check complete",
        checked: services.length,
        pastDue: pastDueServices.length,
        notified: notifiedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

**Step 2: Deploy the Edge Function**

```bash
mcp__supabase__deploy_edge_function(
  name: "check-past-due",
  entrypoint_path: "index.ts",
  verify_jwt: false,  // Called by pg_cron, no JWT
  files: [{ name: "index.ts", content: "[content above]" }]
)
```

**Step 3: Commit local file**

```bash
mkdir -p supabase/functions/check-past-due
# Create the file with the content above
git add supabase/functions/check-past-due/index.ts
git commit -m "feat(edge): Add check-past-due Edge Function"
```

---

## Task 8: Create Daily Summary Edge Function

**Files:**
- Create: `supabase/functions/daily-summary/index.ts`

**Step 1: Create the Edge Function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PastDueSettings {
  dailySummaryEnabled?: boolean;
  dailySummaryTime?: string;
  thresholdUrgent?: number;
}

interface CourierProfile {
  id: string;
  past_due_settings: PastDueSettings | null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Get courier profile with settings
    const { data: courierData } = await supabase
      .from("profiles")
      .select("id, past_due_settings")
      .eq("role", "courier")
      .single();

    const courier = courierData as CourierProfile | null;
    if (!courier) {
      return new Response(
        JSON.stringify({ error: "Courier not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = courier.past_due_settings || {};

    // Check if daily summary is enabled
    if (!settings.dailySummaryEnabled) {
      return new Response(
        JSON.stringify({ message: "Daily summary disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get today's services
    const { data: services } = await supabase
      .from("services")
      .select("id, status, scheduled_date, scheduled_time_slot, scheduled_time")
      .eq("scheduled_date", todayStr)
      .is("deleted_at", null);

    if (!services) {
      return new Response(
        JSON.stringify({ message: "No services found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const total = services.length;
    const pending = services.filter((s) => s.status === "pending").length;
    const delivered = services.filter((s) => s.status === "delivered").length;

    // Count urgent services (scheduled in next hour)
    const thresholdUrgent = settings.thresholdUrgent ?? 60;
    let urgent = 0;

    for (const service of services) {
      if (service.status !== "pending") continue;

      // Simple urgent check: morning services if before noon, afternoon if after, etc.
      const hour = now.getHours();
      if (
        (service.scheduled_time_slot === "morning" && hour >= 11) ||
        (service.scheduled_time_slot === "afternoon" && hour >= 16) ||
        (service.scheduled_time_slot === "evening" && hour >= 20)
      ) {
        urgent++;
      }
    }

    // Create summary notification
    let message: string;
    if (total === 0) {
      message = "Não tem entregas agendadas para hoje.";
    } else if (pending === 0) {
      message = `Todas as ${total} entregas de hoje foram concluídas!`;
    } else {
      message = `Tem ${total} entrega${total > 1 ? "s" : ""} hoje: ${pending} pendente${pending > 1 ? "s" : ""}`;
      if (urgent > 0) {
        message += `, ${urgent} urgente${urgent > 1 ? "s" : ""}`;
      }
      message += ".";
    }

    await supabase.from("notifications").insert({
      user_id: courier.id,
      type: "service_status",
      title: "Resumo do Dia",
      message,
      service_id: null,
    });

    return new Response(
      JSON.stringify({
        message: "Daily summary sent",
        stats: { total, pending, delivered, urgent },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

**Step 2: Deploy the Edge Function**

```bash
mcp__supabase__deploy_edge_function(
  name: "daily-summary",
  entrypoint_path: "index.ts",
  verify_jwt: false,  // Called by pg_cron
  files: [{ name: "index.ts", content: "[content above]" }]
)
```

**Step 3: Commit local file**

```bash
mkdir -p supabase/functions/daily-summary
# Create the file with the content above
git add supabase/functions/daily-summary/index.ts
git commit -m "feat(edge): Add daily-summary Edge Function"
```

---

## Task 9: Set Up pg_cron Schedules

**Files:**
- Create: `supabase/migrations/028_setup_notification_cron_jobs.sql`

**Step 1: Write the migration**

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store secrets in vault for secure access
-- Note: Run these manually in SQL editor with actual values:
-- SELECT vault.create_secret('https://your-project.supabase.co', 'project_url');
-- SELECT vault.create_secret('your-anon-key', 'anon_key');

-- Schedule past due check every 15 minutes
SELECT cron.schedule(
  'check-past-due-services',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/check-past-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);

-- Schedule daily summary at 8:00 AM (UTC - adjust for timezone)
-- For Portugal (UTC+0/+1), 8:00 local is approximately 7:00 or 8:00 UTC
SELECT cron.schedule(
  'daily-summary-notification',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for scheduled notifications';
```

**Step 2: Apply migration via MCP**

```bash
mcp__supabase__apply_migration(name: "setup_notification_cron_jobs", query: "[SQL above]")
```

**Step 3: Set up vault secrets (manual step)**

Run in Supabase SQL Editor:
```sql
SELECT vault.create_secret('https://kwqrvhbzxncaatxwmaky.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_ANON_KEY', 'anon_key');
```

**Step 4: Commit local migration file**

```bash
git add supabase/migrations/028_setup_notification_cron_jobs.sql
git commit -m "db: Set up pg_cron jobs for scheduled notifications"
```

---

## Task 10: Final Verification

**Step 1: Run type check**

```bash
pnpm run check
```

Expected: 0 errors, 0 warnings

**Step 2: Run security advisor**

```bash
mcp__supabase__get_advisors(type: "security")
```

Check for any new issues.

**Step 3: Verify Edge Functions deployed**

```bash
mcp__supabase__list_edge_functions()
```

Should show: `check-past-due`, `daily-summary` along with existing functions.

**Step 4: Verify cron jobs scheduled**

```sql
SELECT * FROM cron.job;
```

Should show both scheduled jobs.

**Step 5: Test the full flow**

1. Enable selection mode on dashboard
2. Select multiple pending services
3. Click "Reschedule Selected"
4. Pick new date and confirm
5. Verify all services updated
6. Verify clients notified

**Step 6: Final commit**

```bash
git add -A
git commit -m "docs: Mark Phase 5 advanced features complete"
```

---

# Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add notification settings to types | database.types.ts |
| 2 | Update settings UI | courier/settings/+page.* |
| 3 | Add translations | messages/*.json |
| 4 | Add batch selection to dashboard | courier/+page.svelte |
| 5 | Add batch reschedule server action | courier/+page.server.ts |
| 6 | Add batch reschedule dialog UI | courier/+page.svelte |
| 7 | Create past due check Edge Function | functions/check-past-due |
| 8 | Create daily summary Edge Function | functions/daily-summary |
| 9 | Set up pg_cron schedules | migration |
| 10 | Final verification | - |

**Parallel opportunities:**
- Tasks 1-3 (types, UI, translations): Can run in parallel
- Tasks 4-6 (batch UI): Sequential (depend on each other)
- Tasks 7-8 (Edge Functions): Can run in parallel
- Task 9 (cron): Depends on 7-8
- Task 10: Sequential (verification)

**Database changes:**
- Migration 028: pg_cron job schedules

**New Edge Functions:**
- `check-past-due`: Checks for overdue services, sends notifications
- `daily-summary`: Sends morning summary of day's deliveries
