# Workload in Service Requests - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display workload data when courier reviews pending service requests to help make informed accept/suggest/reject decisions.

**Architecture:** New `WorkloadSummary.svelte` component for compact workload display. Server-side calculates workloads for all relevant dates (requested dates + today + tomorrow) and finds next compatible day. Client displays badges on cards and expandable details in dialogs.

**Tech Stack:** SvelteKit, Svelte 5 (runes), shadcn-svelte, Supabase, Paraglide i18n

**Design Document:** See `docs/plans/2026-01-29-workload-in-requests-design.md`

---

## Task 1: Add Translation Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English translation keys**

In `messages/en.json`, add after the existing `workload_drive_time` key (around line 660):

```json
"workload_buffer": "{time} buffer",
"workload_today": "Today",
"workload_tomorrow": "Tomorrow",
"workload_no_date_requested": "No specific date",
"workload_next_compatible": "Next compatible day",
"workload_use_this_date": "Use this date"
```

**Step 2: Add Portuguese translation keys**

In `messages/pt-PT.json`, add the same keys in Portuguese:

```json
"workload_buffer": "{time} folga",
"workload_today": "Hoje",
"workload_tomorrow": "Amanhã",
"workload_no_date_requested": "Sem data específica",
"workload_next_compatible": "Próximo dia compatível",
"workload_use_this_date": "Usar esta data"
```

**Step 3: Build to verify translations compile**

Run: `pnpm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(i18n): add workload summary translation keys"
```

---

## Task 2: Create WorkloadSummary Component

**Files:**
- Create: `src/lib/components/WorkloadSummary.svelte`

**Step 1: Create the component file**

Create `src/lib/components/WorkloadSummary.svelte`:

```svelte
<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { WorkloadEstimate } from '$lib/services/workload.js';
	import { formatMinutesToHuman } from '$lib/utils.js';

	interface Props {
		workload: WorkloadEstimate;
		dateLabel?: string;
		compact?: boolean;
	}

	let { workload, dateLabel, compact = false }: Props = $props();
	let expanded = $state(false);

	const servicesLabel = $derived(
		workload.totalServices === 1 ? m.workload_service_singular() : m.workload_service_plural()
	);

	const statusBg = $derived(
		workload.status === 'comfortable'
			? 'bg-green-50 dark:bg-green-950/30'
			: workload.status === 'tight'
				? 'bg-yellow-50 dark:bg-yellow-950/30'
				: 'bg-red-50 dark:bg-red-950/30'
	);

	const statusColor = $derived(
		workload.status === 'comfortable'
			? 'text-green-600'
			: workload.status === 'tight'
				? 'text-yellow-600'
				: 'text-red-600'
	);

	const statusLabel = $derived(
		workload.status === 'comfortable'
			? m.workload_status_comfortable({ hours: '' }).split('(')[0].trim()
			: workload.status === 'tight'
				? m.workload_status_tight({ hours: '' }).split('(')[0].trim()
				: m.workload_status_overloaded({ hours: '' }).split(' ')[0]
	);

	const bufferText = $derived(
		workload.bufferMinutes >= 0
			? m.workload_buffer({ time: formatMinutesToHuman(workload.bufferMinutes) })
			: m.workload_status_overloaded({ hours: formatMinutesToHuman(Math.abs(workload.bufferMinutes)) })
	);

	const StatusIcon = $derived(
		workload.status === 'comfortable'
			? CheckCircle
			: workload.status === 'tight'
				? Clock
				: AlertTriangle
	);
</script>

{#if compact}
	<!-- Compact mode: single line, no expand -->
	<div class="flex items-center gap-2 text-sm {statusBg} rounded-md px-2 py-1">
		<svelte:component this={StatusIcon} class="size-4 {statusColor}" />
		<span class={statusColor}>{statusLabel}</span>
		<span class="text-muted-foreground">·</span>
		<span class="text-muted-foreground">{workload.totalServices} {servicesLabel}</span>
	</div>
{:else}
	<!-- Full mode: expandable -->
	<Collapsible.Root bind:open={expanded}>
		<div class="{statusBg} rounded-lg overflow-hidden">
			<Collapsible.Trigger class="w-full text-left px-3 py-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if dateLabel}
							<span class="text-sm font-medium">{dateLabel}</span>
						{/if}
						<svelte:component this={StatusIcon} class="size-4 {statusColor}" />
						<span class="text-sm {statusColor}">{statusLabel}</span>
						<span class="text-sm text-muted-foreground">·</span>
						<span class="text-sm text-muted-foreground">{workload.totalServices} {servicesLabel}</span>
						<span class="text-sm text-muted-foreground">·</span>
						<span class="text-sm text-muted-foreground">{bufferText}</span>
					</div>
					{#if expanded}
						<ChevronUp class="size-4 text-muted-foreground" />
					{:else}
						<ChevronDown class="size-4 text-muted-foreground" />
					{/if}
				</div>
			</Collapsible.Trigger>
			<Collapsible.Content>
				<div class="px-3 pb-3 pt-1 border-t border-border/50">
					<div class="space-y-1 text-sm">
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.workload_driving()}</span>
							<span>{formatMinutesToHuman(workload.drivingTimeMinutes)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.workload_service_time()}</span>
							<span>{formatMinutesToHuman(workload.serviceTimeMinutes)}</span>
						</div>
						{#if workload.breakTimeMinutes > 0}
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.workload_breaks()}</span>
								<span>{formatMinutesToHuman(workload.breakTimeMinutes)}</span>
							</div>
						{/if}
						<div class="border-t pt-1 flex justify-between font-medium">
							<span>{m.workload_total_needed()}</span>
							<span>{formatMinutesToHuman(workload.totalTimeMinutes)}</span>
						</div>
					</div>
				</div>
			</Collapsible.Content>
		</div>
	</Collapsible.Root>
{/if}
```

**Step 2: Verify component compiles**

Run: `pnpm run check`
Expected: No TypeScript or Svelte errors

**Step 3: Commit**

```bash
git add src/lib/components/WorkloadSummary.svelte
git commit -m "feat: add WorkloadSummary component for compact workload display"
```

---

## Task 3: Add Workload Data to Server Load Function

**Files:**
- Modify: `src/routes/courier/requests/+page.server.ts`

**Step 1: Add imports at top of file**

After existing imports (around line 5), add:

```typescript
import { calculateDayWorkload, getWorkloadSettings, type WorkloadEstimate } from '$lib/services/workload.js';
```

**Step 2: Modify load function to calculate workloads**

Replace the existing `load` function (lines 41-68) with:

```typescript
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load pending service requests (services with request_status = 'pending')
	const { data: pendingRequests } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone)')
		.eq('request_status', 'pending')
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	// Load services with pending reschedule requests (only client-initiated, not courier's own)
	const { data: pendingReschedules } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone)')
		.not('pending_reschedule_date', 'is', null)
		.neq('pending_reschedule_requested_by', user.id)
		.is('deleted_at', null)
		.order('pending_reschedule_requested_at', { ascending: true });

	// Get courier profile for workload settings
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('workload_settings')
		.eq('id', user.id)
		.single();

	const settings = getWorkloadSettings(courierProfile?.workload_settings);

	// Collect unique dates from requests
	const uniqueDates = new Set<string>();
	const requests = (pendingRequests || []) as (Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> })[];
	for (const req of requests) {
		if (req.requested_date) {
			uniqueDates.add(req.requested_date);
		}
	}

	// Always include today and tomorrow
	const today = new Date();
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const todayStr = today.toISOString().split('T')[0];
	const tomorrowStr = tomorrow.toISOString().split('T')[0];

	uniqueDates.add(todayStr);
	uniqueDates.add(tomorrowStr);

	// Calculate workload for each unique date
	const workloadByDate: Record<string, WorkloadEstimate> = {};
	for (const dateStr of uniqueDates) {
		const date = new Date(dateStr + 'T12:00:00'); // Noon to avoid timezone issues
		workloadByDate[dateStr] = await calculateDayWorkload(supabase, user.id, date, settings);
	}

	// Find next compatible day (scan up to 14 days ahead)
	let nextCompatibleDay: { date: string; workload: WorkloadEstimate } | null = null;
	for (let i = 0; i < 14; i++) {
		const checkDate = new Date(today);
		checkDate.setDate(checkDate.getDate() + i);
		const checkDateStr = checkDate.toISOString().split('T')[0];

		// Use cached workload if available, otherwise calculate
		let workload = workloadByDate[checkDateStr];
		if (!workload) {
			const date = new Date(checkDateStr + 'T12:00:00');
			workload = await calculateDayWorkload(supabase, user.id, date, settings);
			workloadByDate[checkDateStr] = workload;
		}

		if (workload.status === 'comfortable') {
			nextCompatibleDay = { date: checkDateStr, workload };
			break;
		}
	}

	return {
		pendingRequests: requests,
		pendingReschedules: (pendingReschedules || []) as (Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> })[],
		workloadByDate,
		todayStr,
		tomorrowStr,
		nextCompatibleDay
	};
};
```

**Step 3: Verify server code compiles**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/routes/courier/requests/+page.server.ts
git commit -m "feat: add workload calculations to requests page load"
```

---

## Task 4: Add Workload Badge to Request Cards

**Files:**
- Modify: `src/routes/courier/requests/+page.svelte`

**Step 1: Add WorkloadSummary import**

After existing imports (around line 13), add:

```typescript
import WorkloadSummary from '$lib/components/WorkloadSummary.svelte';
```

**Step 2: Add helper function for workload lookup**

After the `formatTimeSlot` function (around line 93), add:

```typescript
function getWorkloadForService(service: ServiceWithClient): { workload: WorkloadEstimate; label: string } | null {
	if (service.requested_date && data.workloadByDate[service.requested_date]) {
		return {
			workload: data.workloadByDate[service.requested_date],
			label: formatRequestDate(service.requested_date)
		};
	}
	// No date requested - use today's workload
	if (data.workloadByDate[data.todayStr]) {
		return {
			workload: data.workloadByDate[data.todayStr],
			label: m.workload_today()
		};
	}
	return null;
}
```

Also add the WorkloadEstimate type import at the top:

```typescript
import type { WorkloadEstimate } from '$lib/services/workload.js';
```

**Step 3: Add workload badge to request cards**

Find the "Requested schedule" section in the card (around line 378-392). After the closing `{/if}` for the requested schedule block, add the workload badge:

```svelte
								<!-- Workload indicator -->
								{@const workloadInfo = getWorkloadForService(service)}
								{#if workloadInfo}
									<div class="flex items-center gap-2">
										{#if !service.requested_date}
											<span class="text-sm text-muted-foreground">{m.workload_today()}:</span>
										{/if}
										<WorkloadSummary workload={workloadInfo.workload} compact />
									</div>
								{/if}
```

**Step 4: Verify component renders**

Run: `pnpm run dev`
Navigate to `/courier/requests` and verify the workload badges appear on request cards.

**Step 5: Commit**

```bash
git add src/routes/courier/requests/+page.svelte
git commit -m "feat: add workload badge to request cards"
```

---

## Task 5: Add Workload to Accept Dialog

**Files:**
- Modify: `src/routes/courier/requests/+page.svelte`

**Step 1: Find the Accept Dialog section**

Locate the Accept Dialog (around line 489-530).

**Step 2: Add workload summary to Accept Dialog**

After the service details block (around line 511, after the date/time display), add:

```svelte
				<!-- Workload for requested date -->
				{#if selectedService}
					{@const workloadInfo = getWorkloadForService(selectedService)}
					{#if workloadInfo}
						<div class="mt-4">
							<WorkloadSummary workload={workloadInfo.workload} dateLabel={workloadInfo.label} />
						</div>
					{/if}

					<!-- If no date requested, also show tomorrow -->
					{#if !selectedService.requested_date && data.workloadByDate[data.tomorrowStr]}
						<div class="mt-2">
							<WorkloadSummary
								workload={data.workloadByDate[data.tomorrowStr]}
								dateLabel={m.workload_tomorrow()}
							/>
						</div>
					{/if}

					<!-- Next compatible day suggestion if neither today nor tomorrow is comfortable -->
					{#if !selectedService.requested_date && data.nextCompatibleDay}
						{@const todayWorkload = data.workloadByDate[data.todayStr]}
						{@const tomorrowWorkload = data.workloadByDate[data.tomorrowStr]}
						{#if todayWorkload?.status !== 'comfortable' && tomorrowWorkload?.status !== 'comfortable'}
							<div class="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
								<div class="flex items-center gap-2 text-sm">
									<span class="text-blue-600">💡</span>
									<span class="text-blue-600 font-medium">
										{m.workload_next_compatible()}: {formatRequestDate(data.nextCompatibleDay.date)}
									</span>
								</div>
							</div>
						{/if}
					{/if}
				{/if}
```

**Step 3: Test the Accept Dialog**

Run: `pnpm run dev`
Click "Aceitar" on a request and verify the workload summary appears in the dialog.

**Step 4: Commit**

```bash
git add src/routes/courier/requests/+page.svelte
git commit -m "feat: add workload summary to Accept dialog"
```

---

## Task 6: Add Workload and Next Compatible Day to Suggest Dialog

**Files:**
- Modify: `src/routes/courier/requests/+page.svelte`

**Step 1: Find the Suggest Dialog section**

Locate the Suggest Dialog (around line 572-624).

**Step 2: Add helper function for auto-filling date**

After the existing helper functions, add:

```typescript
function useNextCompatibleDay() {
	if (data.nextCompatibleDay) {
		suggestedDate = data.nextCompatibleDay.date;
	}
}
```

**Step 3: Replace the Suggest Dialog content**

Find the Suggest Dialog content section. After the "Pedido original" section (showing requested schedule), add the workload and suggestion:

```svelte
		<!-- Workload for originally requested date -->
		{#if selectedService?.requested_date && data.workloadByDate[selectedService.requested_date]}
			<div class="mt-2">
				<WorkloadSummary
					workload={data.workloadByDate[selectedService.requested_date]}
				/>
			</div>
		{/if}

		<!-- Next compatible day suggestion (only if requested date isn't comfortable) -->
		{#if data.nextCompatibleDay}
			{@const requestedWorkload = selectedService?.requested_date
				? data.workloadByDate[selectedService.requested_date]
				: null}
			{#if !requestedWorkload || requestedWorkload.status !== 'comfortable'}
				<div class="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2 text-sm">
							<span class="text-blue-600">💡</span>
							<span class="text-blue-600 font-medium">
								{m.workload_next_compatible()}: {formatRequestDate(data.nextCompatibleDay.date)}
							</span>
						</div>
						<Button variant="outline" size="sm" onclick={useNextCompatibleDay}>
							{m.workload_use_this_date()}
						</Button>
					</div>
				</div>
			{/if}
		{/if}
```

**Step 4: Test the Suggest Dialog**

Run: `pnpm run dev`
Click "Sugerir" on a request and verify:
1. The workload for the requested date appears
2. If not comfortable, the next compatible day suggestion appears
3. Clicking "Usar esta data" fills the date picker

**Step 5: Commit**

```bash
git add src/routes/courier/requests/+page.svelte
git commit -m "feat: add workload and next compatible day to Suggest dialog"
```

---

## Task 7: Final Testing and Cleanup

**Step 1: Run full type check**

Run: `pnpm run check`
Expected: No errors

**Step 2: Run build**

Run: `pnpm run build`
Expected: Build succeeds

**Step 3: Manual testing checklist**

- [ ] Card badge shows correct status for requested date
- [ ] Card badge shows "Hoje" status when no date requested
- [ ] Accept dialog shows expandable workload
- [ ] Accept dialog shows today + tomorrow when no date requested
- [ ] Accept dialog shows next compatible suggestion when appropriate
- [ ] Suggest dialog shows requested date workload
- [ ] Suggest dialog shows next compatible day when appropriate
- [ ] "Usar esta data" button auto-fills date picker
- [ ] Status colors match (green/yellow/red)
- [ ] All text properly localized (switch between PT-PT and EN)

**Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: workload in requests - final cleanup"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add translation keys | `messages/*.json` |
| 2 | Create WorkloadSummary component | `src/lib/components/WorkloadSummary.svelte` |
| 3 | Add workload data to server load | `src/routes/courier/requests/+page.server.ts` |
| 4 | Add workload badge to cards | `src/routes/courier/requests/+page.svelte` |
| 5 | Add workload to Accept dialog | `src/routes/courier/requests/+page.svelte` |
| 6 | Add workload to Suggest dialog | `src/routes/courier/requests/+page.svelte` |
| 7 | Final testing | - |
