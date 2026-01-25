# Past Due System Phase 2 Implementation Plan

> **Status:** IN PROGRESS
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Enable courier to reschedule past-due services with client notification via existing notification system.

**Architecture:**
- Add reschedule tracking fields to services table
- Create RescheduleDialog component that wraps existing SchedulePicker
- Add server action for reschedule with notification insert
- Leverage existing NotificationBell for real-time client notifications

**Tech Stack:** SvelteKit, Svelte 5, Supabase, shadcn-svelte Dialog, existing SchedulePicker

**Pre-existing:** Translations for reschedule already exist in both en.json and pt-PT.json

---

## Task 1: Create Database Migration for Reschedule Tracking

**Files:**
- Create: `supabase/migrations/024_add_reschedule_tracking.sql`

**Step 1: Write migration SQL**

```sql
-- Add reschedule tracking fields to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS
  reschedule_count integer DEFAULT 0;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  last_rescheduled_at timestamptz;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  last_rescheduled_by uuid REFERENCES profiles(id);

-- Index for efficient queries on rescheduled services
CREATE INDEX IF NOT EXISTS idx_services_rescheduled
  ON services(last_rescheduled_at)
  WHERE last_rescheduled_at IS NOT NULL;
```

**Step 2: Apply migration via Supabase MCP**

Run:
```
mcp__supabase__apply_migration(
  name: "add_reschedule_tracking",
  query: <migration SQL above>
)
```

**Step 3: Verify migration applied**

Run:
```
mcp__supabase__list_tables(schemas: ["public"])
```

Expected: services table exists (migration applied successfully)

**Step 4: Commit**

```bash
git add supabase/migrations/024_add_reschedule_tracking.sql
git commit -m "db: Add reschedule tracking fields to services"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts:78-110` (services Row type)

**Step 1: Add reschedule tracking fields to Service Row type**

Find the services Row type (around line 78) and add after `price_breakdown`:

```typescript
// Reschedule tracking (Phase 2 Past Due)
reschedule_count: number;
last_rescheduled_at: string | null;
last_rescheduled_by: string | null;
```

**Step 2: Add to Insert type**

In the services Insert type (around line 117), add:

```typescript
// Reschedule tracking (Phase 2 Past Due)
reschedule_count?: number;
last_rescheduled_at?: string | null;
last_rescheduled_by?: string | null;
```

**Step 3: Add to Update type**

In the services Update type (around line 145), add:

```typescript
// Reschedule tracking (Phase 2 Past Due)
reschedule_count?: number;
last_rescheduled_at?: string | null;
last_rescheduled_by?: string | null;
```

**Step 4: Type check**

Run: `pnpm run check`
Expected: No errors related to reschedule fields

**Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "types: Add reschedule tracking fields to Service type"
```

---

## Task 3: Create RescheduleDialog Component

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
	import { CalendarClock } from '@lucide/svelte';

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
			<Dialog.Title class="flex items-center gap-2">
				<CalendarClock class="size-5" />
				{m.reschedule_service()}
			</Dialog.Title>
			<Dialog.Description>{m.reschedule_service_desc()}</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if error}
				<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<SchedulePicker
				selectedDate={newDate}
				selectedTimeSlot={newTimeSlot}
				selectedTime={newTime}
				onDateChange={(date) => (newDate = date)}
				onTimeSlotChange={(slot) => (newTimeSlot = slot)}
				onTimeChange={(time) => (newTime = time)}
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

**Step 2: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/components/RescheduleDialog.svelte
git commit -m "feat(past-due): Create RescheduleDialog component"
```

---

## Task 4: Add Reschedule Server Action

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.server.ts:36-115` (actions object)

**Step 1: Add reschedule action after deleteService action**

Add this new action at the end of the actions object (after line 114, before the closing `}`):

```typescript
,
reschedule: async ({ params, request, locals: { supabase, safeGetSession } }) => {
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

	const userProfile = profile as { role: string } | null;
	if (userProfile?.role !== 'courier') {
		return { success: false, error: 'Unauthorized' };
	}

	const formData = await request.formData();
	const newDate = formData.get('date') as string;
	const newTimeSlot = formData.get('time_slot') as string;
	const newTime = formData.get('time') as string | null;
	const reason = formData.get('reason') as string;

	if (!newDate || !newTimeSlot) {
		return { success: false, error: 'Date and time slot required' };
	}

	// Get current service for notification
	const { data: service } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name)')
		.eq('id', params.id)
		.single();

	if (!service) {
		return { success: false, error: 'Service not found' };
	}

	// Update service with new schedule and reschedule tracking
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
		.eq('id', params.id);

	if (updateError) {
		return { success: false, error: updateError.message };
	}

	// Create notification for client
	const reasonText = reason ? ` Reason: ${reason}` : '';
	await supabase.from('notifications').insert({
		user_id: service.client_id,
		type: 'schedule_change',
		title: 'Delivery Rescheduled',
		message: `Your delivery has been rescheduled to ${newDate}.${reasonText}`,
		service_id: params.id
	});

	return { success: true };
}
```

**Step 2: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 3: Commit**

```bash
git add "src/routes/courier/services/[id]/+page.server.ts"
git commit -m "feat(past-due): Add reschedule server action with notification"
```

---

## Task 5: Add Reschedule Button to Service Detail UI

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.svelte`

**Step 1: Add import for RescheduleDialog**

After the existing imports (around line 11), add:

```typescript
import RescheduleDialog from '$lib/components/RescheduleDialog.svelte';
import { CalendarClock } from '@lucide/svelte';
```

**Step 2: Add import for TimeSlot type**

Update the type import to include TimeSlot:

```typescript
import type { Service, TimeSlot } from '$lib/database.types.js';
```

Note: If TimeSlot is not already imported, add it.

**Step 3: Add state for dialog**

After the existing state declarations (around line 36), add:

```typescript
let showRescheduleDialog = $state(false);
```

**Step 4: Add reschedule handler function**

After the handleDelete function (around line 113), add:

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
	if (result.type === 'failure' || result.data?.success === false) {
		throw new Error(result.data?.error || 'Failed to reschedule');
	}

	await invalidateAll();
}
```

**Step 5: Add Reschedule button in quick actions**

Find the quick actions area (around line 177-189, the div with "Mark Delivered" button). Add the Reschedule button before the status toggle:

```svelte
{#if service.status === 'pending'}
	<Button variant="outline" size="sm" onclick={() => (showRescheduleDialog = true)}>
		<CalendarClock class="mr-2 size-4" />
		{m.reschedule()}
	</Button>
{/if}
```

The full actions section should look like:

```svelte
<div class="flex gap-2">
	{#if service.status === 'pending'}
		<Button variant="outline" size="sm" onclick={() => (showRescheduleDialog = true)}>
			<CalendarClock class="mr-2 size-4" />
			{m.reschedule()}
		</Button>
		<Button size="sm" onclick={() => confirmStatusChange('delivered')}>
			<CheckCircle class="mr-2 size-4" />
			{m.mark_delivered()}
		</Button>
	{:else}
		<Button variant="outline" size="sm" onclick={() => confirmStatusChange('pending')}>
			<Circle class="mr-2 size-4" />
			{m.mark_pending()}
		</Button>
	{/if}
</div>
```

**Step 6: Add RescheduleDialog at end of component**

After the Delete Confirmation Dialog (around line 397), add:

```svelte
<!-- Reschedule Dialog -->
<RescheduleDialog
	{service}
	bind:open={showRescheduleDialog}
	onReschedule={handleReschedule}
/>
```

**Step 7: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 8: Commit**

```bash
git add "src/routes/courier/services/[id]/+page.svelte"
git commit -m "feat(past-due): Add reschedule button to service detail page"
```

---

## Task 6: Regenerate Paraglide Messages

**Files:**
- No file changes (command only)

**Step 1: Regenerate paraglide**

The reschedule translations already exist in en.json and pt-PT.json, but ensure paraglide has compiled them:

Run:
```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide
```

Expected: Paraglide regenerates message functions

**Step 2: Type check**

Run: `pnpm run check`
Expected: No errors - all message functions should be available

---

## Task 7: Final Verification

**Step 1: Type check**

Run: `pnpm run check`
Expected: 0 errors, 0 warnings

**Step 2: Run security advisor**

Run:
```
mcp__supabase__get_advisors(type: "security")
```

Expected: No new security issues from reschedule changes

**Step 3: Manual testing checklist**

- [ ] Navigate to a pending service detail page
- [ ] Reschedule button appears next to "Mark Delivered"
- [ ] Click Reschedule - dialog opens
- [ ] Current date/time pre-filled in SchedulePicker
- [ ] Select new date and time slot
- [ ] Optionally add reason
- [ ] Click Reschedule - dialog closes, page refreshes
- [ ] Check service shows new scheduled date
- [ ] Login as client - notification appears in NotificationBell
- [ ] Notification shows reschedule message

**Step 4: Update full implementation plan**

Mark Phase 2 as complete in `docs/plans/2026-01-25-past-due-full-implementation.md`

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(past-due): Phase 2 verification fixes"
```

**Step 6: Final commit**

```bash
git add docs/plans/
git commit -m "docs: Mark Phase 2 past due implementation complete"
```

---

## Summary

After completing these tasks:
- Services table has reschedule tracking (count, timestamp, by whom)
- RescheduleDialog component wraps SchedulePicker for date/time selection
- Courier can reschedule pending services from detail page
- Client receives notification via existing notification system
- Real-time notification appears in NotificationBell

**Database Changes:**
- Migration 024: adds `reschedule_count`, `last_rescheduled_at`, `last_rescheduled_by` to services

**New Components:**
- `RescheduleDialog.svelte` - Modal for rescheduling with reason

**Modified Files:**
- `src/lib/database.types.ts` - New reschedule fields
- `src/routes/courier/services/[id]/+page.server.ts` - Reschedule action
- `src/routes/courier/services/[id]/+page.svelte` - Reschedule button + dialog

**Next Phase:** Phase 3 will add configurable urgency thresholds and settings.
