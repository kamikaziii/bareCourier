# Past Due System - Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete past due detection, urgency display, rescheduling workflows, and configurable settings.

**Architecture:**
- Phase 1: Computed urgency on render (no DB changes)
- Phase 2: Courier reschedule with notifications (DB: reschedule tracking fields)
- Phase 3: Configurable settings (DB: settings JSONB)
- Phase 4: Client reschedule requests (DB: reschedule history table)
- Phase 5: Batch operations and notifications

**Tech Stack:** SvelteKit, Supabase, existing notification system

---

# Phase 1: Core Past Due Display (MVP)

**Status:** ✅ Foundation complete (utilities, component, i18n created)
**Remaining:** Wire up badges and sorting in UI

---

## Task 1.1: Add Urgency Badge to Dashboard Service Cards

**Files:**
- Modify: `src/routes/courier/+page.svelte:259`

**Step 1: Add UrgencyBadge after status badge**

In the service card's badge area (line ~259), add before the status span:
```svelte
<div class="flex items-center gap-2">
	<UrgencyBadge service={service} size="sm" />
	<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ...">
```

**Step 2: Commit**
```bash
git add src/routes/courier/+page.svelte
git commit -m "feat(past-due): Add urgency badge to dashboard cards"
```

---

## Task 1.2: Sort Dashboard Services by Urgency

**Files:**
- Modify: `src/routes/courier/+page.svelte:245`

**Step 1: Wrap services loop with sortByUrgency**

Change:
```svelte
{#each services as service (service.id)}
```
To:
```svelte
{#each sortByUrgency(services) as service (service.id)}
```

**Step 2: Commit**
```bash
git add src/routes/courier/+page.svelte
git commit -m "feat(past-due): Sort dashboard by urgency priority"
```

---

## Task 1.3: Add Urgency Badge to Services List

**Files:**
- Modify: `src/routes/courier/services/+page.svelte:449`

**Step 1: Add UrgencyBadge in services list card**

In the badge area (line ~449), add before the date span:
```svelte
<div class="flex items-center gap-2">
	<UrgencyBadge service={service} size="sm" />
	<span class="text-xs text-muted-foreground">
```

**Step 2: Commit**
```bash
git add src/routes/courier/services/+page.svelte
git commit -m "feat(past-due): Add urgency badge to services list"
```

---

## Task 1.4: Sort Services List by Urgency

**Files:**
- Modify: `src/routes/courier/services/+page.svelte:211-224`

**Step 1: Wrap filteredServices with sortByUrgency**

Change the derived:
```typescript
const filteredServices = $derived(
	sortByUrgency(
		services.filter((s) => {
			// existing filter logic
		})
	)
);
```

**Step 2: Commit**
```bash
git add src/routes/courier/services/+page.svelte
git commit -m "feat(past-due): Sort services list by urgency"
```

---

## Task 1.5: Verify Phase 1 Complete

**Step 1: Type check**
```bash
pnpm run check
```

**Step 2: Manual test**
- [ ] Dashboard shows urgency badges
- [ ] Dashboard sorts past due first
- [ ] Services list shows urgency badges
- [ ] Services list sorts by urgency
- [ ] PT/EN translations work

**Step 3: Commit any fixes**
```bash
git add -A && git commit -m "fix(past-due): Phase 1 polish"
```

---

# Phase 2: Courier Reschedule

**Goal:** Enable courier to reschedule services with client notification

---

## Task 2.1: Create Database Migration for Reschedule Tracking

**Files:**
- Create: `supabase/migrations/024_add_reschedule_tracking.sql`

**Step 1: Write migration**

```sql
-- Add reschedule tracking fields to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS
  reschedule_count integer DEFAULT 0;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  last_rescheduled_at timestamptz;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  last_rescheduled_by uuid REFERENCES profiles(id);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_services_rescheduled
  ON services(last_rescheduled_at)
  WHERE last_rescheduled_at IS NOT NULL;
```

**Step 2: Apply migration**

Use Supabase MCP:
```
mcp__supabase__apply_migration(
  name: "add_reschedule_tracking",
  query: <migration SQL>
)
```

**Step 3: Commit**
```bash
git add supabase/migrations/024_add_reschedule_tracking.sql
git commit -m "db: Add reschedule tracking fields to services"
```

---

## Task 2.2: Update TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts`

**Step 1: Add new fields to Service type**

In the services Row type, add:
```typescript
reschedule_count: number;
last_rescheduled_at: string | null;
last_rescheduled_by: string | null;
```

**Step 2: Commit**
```bash
git add src/lib/database.types.ts
git commit -m "types: Add reschedule tracking fields"
```

---

## Task 2.3: Create RescheduleDialog Component

**Files:**
- Create: `src/lib/components/RescheduleDialog.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { Service, TimeSlot } from '$lib/database.types.js';

	interface Props {
		service: Service;
		open: boolean;
		onReschedule: (data: {
			date: string;
			timeSlot: TimeSlot;
			time: string | null;
			reason: string;
		}) => Promise<void>;
	}

	let { service, open = $bindable(), onReschedule }: Props = $props();

	let newDate = $state<string | null>(service.scheduled_date);
	let newTimeSlot = $state<TimeSlot | null>(service.scheduled_time_slot);
	let newTime = $state<string | null>(service.scheduled_time);
	let reason = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit() {
		if (!newDate || !newTimeSlot) return;

		loading = true;
		error = '';

		try {
			await onReschedule({
				date: newDate,
				timeSlot: newTimeSlot,
				time: newTime,
				reason
			});
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : m.reschedule_error();
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		newDate = service.scheduled_date;
		newTimeSlot = service.scheduled_time_slot;
		newTime = service.scheduled_time;
		reason = '';
		error = '';
	}

	$effect(() => {
		if (open) resetForm();
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.reschedule_service()}</Dialog.Title>
			<Dialog.Description>{m.reschedule_service_desc()}</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if error}
				<div class="text-sm text-destructive">{error}</div>
			{/if}

			<SchedulePicker
				bind:selectedDate={newDate}
				bind:selectedTimeSlot={newTimeSlot}
				bind:selectedTime={newTime}
			/>

			<div class="space-y-2">
				<Label for="reason">{m.reschedule_reason()}</Label>
				<Textarea
					id="reason"
					bind:value={reason}
					placeholder={m.reschedule_reason_placeholder()}
					rows={2}
				/>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={loading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleSubmit} disabled={!newDate || !newTimeSlot || loading}>
				{loading ? m.saving() : m.reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
```

**Step 2: Commit**
```bash
git add src/lib/components/RescheduleDialog.svelte
git commit -m "feat(past-due): Create RescheduleDialog component"
```

---

## Task 2.4: Add Reschedule Action to Service Detail Page

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.server.ts`

**Step 1: Add reschedule form action**

Add this action to the existing actions object:
```typescript
reschedule: async ({ request, locals, params }) => {
	const { supabase, safeGetSession } = locals;
	const { session, user } = await safeGetSession();

	if (!session || !user) {
		return fail(401, { error: 'Unauthorized' });
	}

	const formData = await request.formData();
	const newDate = formData.get('date') as string;
	const newTimeSlot = formData.get('time_slot') as string;
	const newTime = formData.get('time') as string | null;
	const reason = formData.get('reason') as string;

	if (!newDate || !newTimeSlot) {
		return fail(400, { error: 'Date and time slot required' });
	}

	// Get current service for notification
	const { data: service } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name)')
		.eq('id', params.id)
		.single();

	if (!service) {
		return fail(404, { error: 'Service not found' });
	}

	// Update service
	const { error: updateError } = await supabase
		.from('services')
		.update({
			scheduled_date: newDate,
			scheduled_time_slot: newTimeSlot,
			scheduled_time: newTime || null,
			reschedule_count: (service.reschedule_count || 0) + 1,
			last_rescheduled_at: new Date().toISOString(),
			last_rescheduled_by: user.id
		})
		.eq('id', params.id);

	if (updateError) {
		return fail(500, { error: updateError.message });
	}

	// Create notification for client
	await supabase.from('notifications').insert({
		user_id: service.client_id,
		type: 'schedule_change',
		title: 'Delivery Rescheduled',
		message: `Your delivery has been rescheduled to ${newDate}. ${reason ? `Reason: ${reason}` : ''}`
	});

	return { success: true };
}
```

**Step 2: Commit**
```bash
git add src/routes/courier/services/[id]/+page.server.ts
git commit -m "feat(past-due): Add reschedule server action"
```

---

## Task 2.5: Add Reschedule Button to Service Detail UI

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.svelte`

**Step 1: Import RescheduleDialog and add state**

Add imports:
```typescript
import RescheduleDialog from '$lib/components/RescheduleDialog.svelte';
import { invalidateAll } from '$app/navigation';
```

Add state:
```typescript
let showRescheduleDialog = $state(false);
```

**Step 2: Add reschedule handler**

```typescript
async function handleReschedule(data: {
	date: string;
	timeSlot: TimeSlot;
	time: string | null;
	reason: string;
}) {
	const formData = new FormData();
	formData.set('date', data.date);
	formData.set('time_slot', data.timeSlot);
	if (data.time) formData.set('time', data.time);
	formData.set('reason', data.reason);

	const response = await fetch('?/reschedule', {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		throw new Error('Failed to reschedule');
	}

	const result = await response.json();
	if (result.type === 'failure') {
		throw new Error(result.data?.error || 'Failed to reschedule');
	}

	await invalidateAll();
}
```

**Step 3: Add Reschedule button in actions area**

Near other action buttons (Mark Delivered, Edit, Delete), add:
```svelte
{#if service.status === 'pending'}
	<Button variant="outline" onclick={() => (showRescheduleDialog = true)}>
		{m.reschedule()}
	</Button>
{/if}
```

**Step 4: Add dialog at end of component**

```svelte
<RescheduleDialog
	{service}
	bind:open={showRescheduleDialog}
	onReschedule={handleReschedule}
/>
```

**Step 5: Commit**
```bash
git add src/routes/courier/services/[id]/+page.svelte
git commit -m "feat(past-due): Add reschedule button to service detail"
```

---

## Task 2.6: Verify Phase 2 Complete

**Step 1: Type check**
```bash
pnpm run check
```

**Step 2: Manual test**
- [ ] Reschedule button appears for pending services
- [ ] Dialog opens with current schedule pre-filled
- [ ] Can select new date/time
- [ ] Service updates on submit
- [ ] Client receives notification
- [ ] reschedule_count increments

**Step 3: Commit any fixes**
```bash
git add -A && git commit -m "fix(past-due): Phase 2 polish"
```

---

# Phase 3: Settings & Configuration

**Goal:** Make thresholds and policies configurable

---

## Task 3.1: Create Database Migration for Settings

**Files:**
- Create: `supabase/migrations/025_add_past_due_settings.sql`

**Step 1: Write migration**

```sql
-- Add past due settings to profiles (for courier)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  past_due_settings jsonb DEFAULT '{
    "gracePeriodStandard": 30,
    "gracePeriodSpecific": 15,
    "thresholdApproaching": 120,
    "thresholdUrgent": 60,
    "thresholdCriticalHours": 24,
    "allowClientReschedule": true,
    "clientMinNoticeHours": 24,
    "clientMaxReschedules": 3
  }'::jsonb;
```

**Step 2: Apply migration via MCP**

**Step 3: Commit**
```bash
git add supabase/migrations/025_add_past_due_settings.sql
git commit -m "db: Add past_due_settings column to profiles"
```

---

## Task 3.2: Update TypeScript Types for Settings

**Files:**
- Modify: `src/lib/database.types.ts`

**Step 1: Add PastDueSettings type**

```typescript
export type PastDueSettings = {
	gracePeriodStandard: number;
	gracePeriodSpecific: number;
	thresholdApproaching: number;
	thresholdUrgent: number;
	thresholdCriticalHours: number;
	allowClientReschedule: boolean;
	clientMinNoticeHours: number;
	clientMaxReschedules: number;
};
```

**Step 2: Add to Profile type**
```typescript
past_due_settings: PastDueSettings | null;
```

**Step 3: Commit**
```bash
git add src/lib/database.types.ts
git commit -m "types: Add PastDueSettings type"
```

---

## Task 3.3: Load Settings in Courier Layout

**Files:**
- Modify: `src/routes/courier/+layout.server.ts`

**Step 1: Include past_due_settings in profile query**

The profile query should already fetch all columns. Add to return:
```typescript
return {
	profile: {
		id: profile.id,
		role: profile.role,
		name: profile.name,
		past_due_settings: profile.past_due_settings
	},
	navCounts: { ... }
};
```

**Step 2: Commit**
```bash
git add src/routes/courier/+layout.server.ts
git commit -m "feat(past-due): Load settings in courier layout"
```

---

## Task 3.4: Add Settings UI Section

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte`

**Step 1: Add "Delivery Deadlines" settings section**

Add a new Card section with:
- Grace period (standard): number input (0-60 min)
- Grace period (specific): number input (0-30 min)
- Approaching threshold: number input (30-180 min)
- Urgent threshold: number input (15-120 min)

**Step 2: Add "Client Rescheduling" settings section**

- Allow clients to reschedule: toggle
- Minimum notice (hours): number input
- Max reschedules per service: number input

**Step 3: Add save handler for settings**

**Step 4: Commit**
```bash
git add src/routes/courier/settings/+page.svelte
git commit -m "feat(past-due): Add settings UI for thresholds"
```

---

## Task 3.5: Use Settings in Urgency Calculation

**Files:**
- Modify: `src/routes/courier/+page.svelte`
- Modify: `src/routes/courier/services/+page.svelte`

**Step 1: Pass settings to sortByUrgency**

Convert settings to PastDueConfig and pass:
```typescript
const config = data.profile.past_due_settings
	? settingsToConfig(data.profile.past_due_settings)
	: undefined;

{#each sortByUrgency(services, config) as service}
```

**Step 2: Commit**
```bash
git add src/routes/courier/+page.svelte src/routes/courier/services/+page.svelte
git commit -m "feat(past-due): Use configurable settings for urgency"
```

---

# Phase 4: Client Reschedule Workflow

**Goal:** Allow clients to request reschedules with approval workflow

---

## Task 4.1: Create Reschedule History Table

**Files:**
- Create: `supabase/migrations/026_create_reschedule_history.sql`

**Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS service_reschedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  initiated_by uuid REFERENCES profiles(id) NOT NULL,
  initiated_by_role text NOT NULL CHECK (initiated_by_role IN ('courier', 'client')),
  old_date date,
  old_time_slot text,
  new_date date NOT NULL,
  new_time_slot text NOT NULL,
  reason text,
  approval_status text DEFAULT 'auto_approved'
    CHECK (approval_status IN ('auto_approved', 'pending', 'approved', 'denied')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  denial_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reschedule_history_service ON service_reschedule_history(service_id);
CREATE INDEX idx_reschedule_history_pending ON service_reschedule_history(approval_status)
  WHERE approval_status = 'pending';

ALTER TABLE service_reschedule_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY reschedule_history_select ON service_reschedule_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'courier')
    OR EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_reschedule_history.service_id
      AND s.client_id = auth.uid()
    )
  );

CREATE POLICY reschedule_history_insert ON service_reschedule_history
  FOR INSERT WITH CHECK (initiated_by = auth.uid());
```

**Step 2: Apply migration via MCP**

**Step 3: Commit**
```bash
git add supabase/migrations/026_create_reschedule_history.sql
git commit -m "db: Create service_reschedule_history table"
```

---

## Task 4.2: Add Pending Reschedule Fields to Services

**Files:**
- Create: `supabase/migrations/027_add_pending_reschedule_fields.sql`

```sql
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_date date;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_time_slot text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_requested_at timestamptz;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_requested_by uuid REFERENCES profiles(id);
```

---

## Task 4.3: Add Reschedule Request to Client Service View

**Files:**
- Modify: `src/routes/client/services/[id]/+page.svelte`
- Modify: `src/routes/client/services/[id]/+page.server.ts`

Add "Request Reschedule" button that:
1. Checks policy (notice hours, max reschedules)
2. If passes: auto-approve and update service
3. If fails: create pending request, notify courier

---

## Task 4.4: Add Pending Reschedules to Courier Requests Page

**Files:**
- Modify: `src/routes/courier/requests/+page.svelte`
- Modify: `src/routes/courier/requests/+page.server.ts`

Add section for pending reschedule requests with approve/deny actions.

---

# Phase 5: Advanced Features

**Goal:** Batch operations and notifications

---

## Task 5.1: Batch Reschedule UI

Add multi-select to dashboard/services list with "Reschedule Selected" action.

---

## Task 5.2: Past Due Notifications

Create Edge Function or scheduled job to:
- Check for past due services
- Send push notifications to courier
- Respect reminder interval settings

---

## Task 5.3: Daily Summary Notification

Create scheduled job to send morning summary of day's deliveries.

---

# Summary

| Phase | Tasks | Database | Status |
|-------|-------|----------|--------|
| 1 | 5 | None | Foundation ✅, UI pending |
| 2 | 6 | 1 migration | Not started |
| 3 | 5 | 1 migration | Not started |
| 4 | 4 | 2 migrations | Not started |
| 5 | 3 | None | Not started |

**Recommended approach:** Complete phases sequentially. Each phase is independently useful.
