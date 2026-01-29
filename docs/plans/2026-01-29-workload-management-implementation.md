# Workload Management System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the courier to see if their day's services fit within available hours, with break tracking and learning from actual delivery times.

**Architecture:** Database stores break logs and delivery time measurements. Services calculate workload estimates. UI shows status bar (break toggle) and dashboard card (workload summary). Learning system improves service time estimates over time.

**Tech Stack:** SvelteKit, Svelte 5 runes, Supabase (Postgres + RLS), shadcn-svelte, Tailwind CSS v4

---

## Phase 1: Foundation

### Task 1.1: Database Migration - Core Tables

**Files:**
- Create: `supabase/migrations/20260129000001_add_workload_management_tables.sql`

**Step 1: Write the migration**

```sql
-- Workload Management System Tables
-- Part of: 2026-01-28-workload-management-design.md

-- Break logs: tracks all breaks (auto lunch, manual toggle, retroactive)
CREATE TABLE break_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  type TEXT NOT NULL CHECK (type IN ('lunch', 'manual', 'retroactive')),
  source TEXT NOT NULL CHECK (source IN ('auto', 'toggle', 'anomaly_prompt', 'daily_review')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying breaks by courier and date
CREATE INDEX idx_break_logs_courier_date ON break_logs (courier_id, started_at);

-- Delivery time logs: tracks actual delivery times for learning
CREATE TABLE delivery_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  driving_time_minutes INTEGER,
  break_time_minutes INTEGER DEFAULT 0,
  delay_reason TEXT CHECK (delay_reason IN ('break', 'traffic', 'customer', 'other')),
  calculated_service_time_minutes INTEGER,
  include_in_learning BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for learning queries
CREATE INDEX idx_delivery_time_logs_courier_learning ON delivery_time_logs (courier_id, include_in_learning, created_at DESC);

-- Daily reviews: tracks end-of-day review completion
CREATE TABLE daily_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  review_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  total_services INTEGER,
  total_work_minutes INTEGER,
  gaps_detected INTEGER,
  gaps_resolved INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(courier_id, review_date)
);

-- RLS Policies
ALTER TABLE break_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reviews ENABLE ROW LEVEL SECURITY;

-- Break logs: courier can manage their own breaks
CREATE POLICY break_logs_courier_all ON break_logs
  FOR ALL TO authenticated
  USING (courier_id = (SELECT auth.uid()));

-- Delivery time logs: courier can manage their own logs
CREATE POLICY delivery_time_logs_courier_all ON delivery_time_logs
  FOR ALL TO authenticated
  USING (courier_id = (SELECT auth.uid()));

-- Daily reviews: courier can manage their own reviews
CREATE POLICY daily_reviews_courier_all ON daily_reviews
  FOR ALL TO authenticated
  USING (courier_id = (SELECT auth.uid()));
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260129000001_add_workload_management_tables.sql
git commit -m "feat(db): add workload management tables (break_logs, delivery_time_logs, daily_reviews)"
```

---

### Task 1.2: Database Migration - Profile Extension

**Files:**
- Create: `supabase/migrations/20260129000002_add_workload_settings_to_profiles.sql`

**Step 1: Write the migration**

```sql
-- Add workload_settings JSONB column to profiles
-- Stores courier's workload preferences

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workload_settings JSONB DEFAULT '{
  "daily_hours": 8,
  "default_service_time_minutes": 15,
  "auto_lunch_start": "12:00",
  "auto_lunch_end": "13:00",
  "review_time": "18:00",
  "learning_enabled": true,
  "learned_service_time_minutes": null,
  "learning_sample_count": 0
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.workload_settings IS 'Workload management settings: daily_hours, service time, lunch slot, review time, learning state';
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260129000002_add_workload_settings_to_profiles.sql
git commit -m "feat(db): add workload_settings column to profiles"
```

---

### Task 1.3: Update TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts`

**Step 1: Add WorkloadSettings type after PastDueSettings (around line 50)**

```typescript
// Workload management settings
export type WorkloadSettings = {
	daily_hours: number;
	default_service_time_minutes: number;
	auto_lunch_start: string; // "HH:MM"
	auto_lunch_end: string; // "HH:MM"
	review_time: string; // "HH:MM"
	learning_enabled: boolean;
	learned_service_time_minutes: number | null;
	learning_sample_count: number;
};

// Break log entry
export type BreakLog = {
	id: string;
	courier_id: string;
	started_at: string;
	ended_at: string | null;
	type: 'lunch' | 'manual' | 'retroactive';
	source: 'auto' | 'toggle' | 'anomaly_prompt' | 'daily_review';
	created_at: string;
};

// Delivery time log entry
export type DeliveryTimeLog = {
	id: string;
	service_id: string;
	courier_id: string;
	started_at: string;
	completed_at: string;
	driving_time_minutes: number | null;
	break_time_minutes: number;
	delay_reason: 'break' | 'traffic' | 'customer' | 'other' | null;
	calculated_service_time_minutes: number | null;
	include_in_learning: boolean;
	created_at: string;
};

// Daily review entry
export type DailyReview = {
	id: string;
	courier_id: string;
	review_date: string;
	completed_at: string | null;
	total_services: number | null;
	total_work_minutes: number | null;
	gaps_detected: number | null;
	gaps_resolved: number | null;
	created_at: string;
};
```

**Step 2: Regenerate database types**

Run: `pnpm run types:generate` (if available) or manually update `database.generated.ts`

**Step 3: Verify types compile**

Run: `pnpm run check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(types): add WorkloadSettings, BreakLog, DeliveryTimeLog, DailyReview types"
```

---

### Task 1.4: Route Calculation - Add Duration to Result [COMPLETED]

**Files:**
- Modify: `src/lib/services/route.ts`
- Modify: `src/lib/services/distance.ts`

**Step 1: Update RouteCalculationResult interface**

Find the interface (around line 15) and add `durationMinutes`:

```typescript
export interface RouteCalculationResult {
	distanceKm: number | null;
	durationMinutes: number | null;
	routeGeometry: string | null;
	distanceResult: ServiceDistanceResult | null;
}
```

**Step 2: Update EMPTY_RESULT constant**

```typescript
const EMPTY_RESULT: RouteCalculationResult = {
	distanceKm: null,
	durationMinutes: null,
	routeGeometry: null,
	distanceResult: null
};
```

**Step 3: Update calculateRouteIfReady function to extract duration**

In the function body, after getting the route result, extract duration:

```typescript
export async function calculateRouteIfReady(
	pickupCoords: [number, number] | null,
	deliveryCoords: [number, number] | null,
	courierSettings?: CourierPricingSettings | null
): Promise<RouteCalculationResult> {
	if (!pickupCoords || !deliveryCoords) {
		return EMPTY_RESULT;
	}

	let distanceKm: number | null = null;
	let durationMinutes: number | null = null;
	let distanceResult: ServiceDistanceResult | null = null;

	try {
		let routeGeometry: string | null = null;

		if (courierSettings) {
			const result = await calculateServiceDistance({
				pickupCoords,
				deliveryCoords,
				warehouseCoords: courierSettings.warehouseCoords,
				pricingMode: courierSettings.pricingMode,
				roundDistance: courierSettings.roundDistance
			});
			distanceResult = result;
			distanceKm = result.totalDistanceKm;
			durationMinutes = result.durationMinutes ?? null;
			routeGeometry = result.geometry || null;
		} else {
			const result = await calculateRoute(pickupCoords, deliveryCoords);
			if (result) {
				distanceKm = result.distanceKm;
				durationMinutes = result.durationMinutes;
				routeGeometry = result.geometry || null;
			} else {
				distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
				// Estimate duration: assume 30 km/h average in city
				durationMinutes = Math.round((distanceKm / 30) * 60);
			}
		}

		return { distanceKm, durationMinutes, routeGeometry, distanceResult };
	} catch {
		distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
		durationMinutes = Math.round((distanceKm / 30) * 60);
		return { distanceKm, durationMinutes, routeGeometry: null, distanceResult: null };
	}
}
```

**Step 4: Update ServiceDistanceResult in distance.ts to include duration**

Modify `src/lib/services/distance.ts` - add to ServiceDistanceResult interface:

```typescript
export interface ServiceDistanceResult {
	totalDistanceKm: number;
	durationMinutes?: number;
	distanceMode: 'warehouse' | 'zone' | 'fallback';
	warehouseToPickupKm?: number;
	pickupToDeliveryKm: number;
	geometry?: string;
}
```

And update `calculateServiceDistance` to return duration from the route calculation.

**Step 5: Verify types compile**

Run: `pnpm run check`
Expected: No type errors

**Step 6: Commit**

```bash
git add src/lib/services/route.ts src/lib/services/distance.ts
git commit -m "feat(route): add durationMinutes to route calculation results"
```

---

### Task 1.5: RouteMap - Display Duration

**Files:**
- Modify: `src/lib/components/RouteMap.svelte`

**Step 1: Add durationMinutes prop**

Update the Props interface (around line 7):

```typescript
interface Props {
	pickupCoords?: [number, number] | null;
	deliveryCoords?: [number, number] | null;
	routeGeometry?: string | null;
	distanceKm?: number | null;
	durationMinutes?: number | null;
	height?: string;
}
```

**Step 2: Destructure the new prop**

```typescript
let {
	pickupCoords = null,
	deliveryCoords = null,
	routeGeometry = null,
	distanceKm = null,
	durationMinutes = null,
	height = '300px'
}: Props = $props();
```

**Step 3: Add i18n message for duration display**

In `src/lib/paraglide/messages/en.json`, add:

```json
"map_distance_duration": "{km} km • ~{minutes} min"
```

In `src/lib/paraglide/messages/pt-PT.json`, add:

```json
"map_distance_duration": "{km} km • ~{minutes} min"
```

**Step 4: Update the display section (around line 175-185)**

Replace the distance display with combined distance + duration:

```svelte
{#if distanceKm !== null || (pickupCoords && deliveryCoords)}
	<div class="flex items-center justify-between">
		{#if distanceKm !== null}
			<span class="text-sm text-muted-foreground">
				{#if durationMinutes !== null}
					{m.map_distance_duration({ km: distanceKm.toFixed(1), minutes: durationMinutes })}
				{:else}
					{m.map_distance({ km: distanceKm.toFixed(1) })}
				{/if}
			</span>
		{:else}
			<span></span>
		{/if}

		{#if pickupCoords && deliveryCoords}
			<button
				type="button"
				class="text-sm text-primary hover:underline"
				onclick={openDirections}
			>
				{m.map_get_directions()} →
			</button>
		{/if}
	</div>
{/if}
```

**Step 5: Verify it renders correctly**

Run: `pnpm run dev`
Navigate to a service creation page and verify duration appears

**Step 6: Commit**

```bash
git add src/lib/components/RouteMap.svelte src/lib/paraglide/messages/
git commit -m "feat(RouteMap): display duration alongside distance"
```

---

### Task 1.6: Update RouteMap Consumers to Pass Duration

**Files:**
- Modify: `src/routes/client/new/+page.svelte`
- Modify: `src/routes/courier/services/new/+page.svelte`
- Modify: `src/routes/courier/services/[id]/edit/+page.svelte`

**Step 1: Update client/new/+page.svelte**

Add `durationMinutes` state (after line 39):

```typescript
let durationMinutes = $state<number | null>(null);
```

Update `calculateDistanceIfReady` to capture duration:

```typescript
async function calculateDistanceIfReady() {
	calculatingDistance = true;
	const result = await calculateRouteShared(pickupCoords, deliveryCoords, courierSettings);
	distanceKm = result.distanceKm;
	durationMinutes = result.durationMinutes;
	routeGeometry = result.routeGeometry;
	distanceResult = result.distanceResult;
	calculatingDistance = false;
}
```

Update RouteMap component usage:

```svelte
<RouteMap
	{pickupCoords}
	{deliveryCoords}
	{routeGeometry}
	{distanceKm}
	{durationMinutes}
	height="200px"
/>
```

**Step 2: Repeat for courier/services/new/+page.svelte**

Same pattern: add state, capture from result, pass to RouteMap.

**Step 3: Repeat for courier/services/[id]/edit/+page.svelte**

Same pattern.

**Step 4: Verify types compile**

Run: `pnpm run check`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/routes/client/new/+page.svelte src/routes/courier/services/new/+page.svelte src/routes/courier/services/*/edit/+page.svelte
git commit -m "feat(forms): pass durationMinutes to RouteMap in service forms"
```

---

## Phase 2: Break Tracking

### Task 2.1: Break Service

**Files:**
- Create: `src/lib/services/breaks.ts`

**Step 1: Create the break management service**

```typescript
/**
 * Break Management Service
 * Handles starting, ending, and querying breaks for the courier.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BreakLog } from '$lib/database.types.js';

export interface CurrentBreak {
	id: string;
	startedAt: Date;
	type: 'lunch' | 'manual';
	elapsedMinutes: number;
}

/**
 * Get the courier's current active break (if any)
 */
export async function getCurrentBreak(
	supabase: SupabaseClient,
	courierId: string
): Promise<CurrentBreak | null> {
	const { data, error } = await supabase
		.from('break_logs')
		.select('*')
		.eq('courier_id', courierId)
		.is('ended_at', null)
		.order('started_at', { ascending: false })
		.limit(1)
		.single();

	if (error || !data) return null;

	const startedAt = new Date(data.started_at);
	const elapsedMinutes = Math.floor((Date.now() - startedAt.getTime()) / 60000);

	return {
		id: data.id,
		startedAt,
		type: data.type as 'lunch' | 'manual',
		elapsedMinutes
	};
}

/**
 * Start a new break
 */
export async function startBreak(
	supabase: SupabaseClient,
	courierId: string,
	type: 'lunch' | 'manual',
	source: 'auto' | 'toggle' = 'toggle'
): Promise<{ success: boolean; error?: string }> {
	// Check if already on break
	const current = await getCurrentBreak(supabase, courierId);
	if (current) {
		return { success: false, error: 'Already on break' };
	}

	const { error } = await supabase.from('break_logs').insert({
		courier_id: courierId,
		started_at: new Date().toISOString(),
		type,
		source
	});

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true };
}

/**
 * End the current break
 */
export async function endBreak(
	supabase: SupabaseClient,
	courierId: string
): Promise<{ success: boolean; durationMinutes?: number; error?: string }> {
	const current = await getCurrentBreak(supabase, courierId);
	if (!current) {
		return { success: false, error: 'Not on break' };
	}

	const endedAt = new Date();
	const { error } = await supabase
		.from('break_logs')
		.update({ ended_at: endedAt.toISOString() })
		.eq('id', current.id);

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true, durationMinutes: current.elapsedMinutes };
}

/**
 * Log a retroactive break (from anomaly prompt or daily review)
 */
export async function logRetroactiveBreak(
	supabase: SupabaseClient,
	courierId: string,
	startedAt: Date,
	endedAt: Date,
	source: 'anomaly_prompt' | 'daily_review'
): Promise<{ success: boolean; error?: string }> {
	const { error } = await supabase.from('break_logs').insert({
		courier_id: courierId,
		started_at: startedAt.toISOString(),
		ended_at: endedAt.toISOString(),
		type: 'retroactive',
		source
	});

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true };
}

/**
 * Get total break time for a date range
 */
export async function getBreakTimeForRange(
	supabase: SupabaseClient,
	courierId: string,
	startDate: Date,
	endDate: Date
): Promise<number> {
	const { data, error } = await supabase
		.from('break_logs')
		.select('started_at, ended_at')
		.eq('courier_id', courierId)
		.gte('started_at', startDate.toISOString())
		.lte('started_at', endDate.toISOString())
		.not('ended_at', 'is', null);

	if (error || !data) return 0;

	return data.reduce((total, log) => {
		const start = new Date(log.started_at);
		const end = new Date(log.ended_at!);
		return total + Math.floor((end.getTime() - start.getTime()) / 60000);
	}, 0);
}
```

**Step 2: Verify types compile**

Run: `pnpm run check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/services/breaks.ts
git commit -m "feat(breaks): add break management service"
```

---

### Task 2.2: WorkStatusBar Component

**Files:**
- Create: `src/lib/components/WorkStatusBar.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
	import { Coffee, Play } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { startBreak, endBreak, getCurrentBreak, type CurrentBreak } from '$lib/services/breaks.js';

	interface Props {
		supabase: SupabaseClient;
		courierId: string;
	}

	let { supabase, courierId }: Props = $props();

	let currentBreak = $state<CurrentBreak | null>(null);
	let loading = $state(false);
	let elapsedMinutes = $state(0);

	// Load initial state
	$effect(() => {
		loadBreakStatus();
	});

	// Update elapsed time every minute when on break
	$effect(() => {
		if (!currentBreak) return;

		const interval = setInterval(() => {
			if (currentBreak) {
				elapsedMinutes = Math.floor((Date.now() - currentBreak.startedAt.getTime()) / 60000);
			}
		}, 60000);

		return () => clearInterval(interval);
	});

	async function loadBreakStatus() {
		currentBreak = await getCurrentBreak(supabase, courierId);
		if (currentBreak) {
			elapsedMinutes = currentBreak.elapsedMinutes;
		}
	}

	async function toggleBreak() {
		loading = true;
		if (currentBreak) {
			await endBreak(supabase, courierId);
		} else {
			await startBreak(supabase, courierId, 'manual', 'toggle');
		}
		await loadBreakStatus();
		loading = false;
	}

	function formatElapsed(minutes: number): string {
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hours}h ${mins}m`;
	}
</script>

<div
	class="flex items-center justify-between px-4 py-2 border-b text-sm
		{currentBreak ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-background'}"
>
	<div class="flex items-center gap-2">
		{#if currentBreak}
			<Coffee class="size-4 text-amber-600" />
			<span class="font-medium text-amber-700 dark:text-amber-400">
				{m.workload_on_break()} ({formatElapsed(elapsedMinutes)})
			</span>
		{:else}
			<div class="size-2 rounded-full bg-green-500"></div>
			<span class="text-muted-foreground">{m.workload_working()}</span>
		{/if}
	</div>

	<Button
		variant="ghost"
		size="sm"
		onclick={toggleBreak}
		disabled={loading}
		class="h-7 px-2 text-xs"
	>
		{#if currentBreak}
			<Play class="size-3 mr-1" />
			{m.workload_resume()}
		{:else}
			<Coffee class="size-3 mr-1" />
			{m.workload_take_break()}
		{/if}
	</Button>
</div>
```

**Step 2: Add i18n messages**

In `src/lib/paraglide/messages/en.json`:

```json
"workload_working": "Working",
"workload_on_break": "On Break",
"workload_resume": "Resume",
"workload_take_break": "Break"
```

In `src/lib/paraglide/messages/pt-PT.json`:

```json
"workload_working": "A trabalhar",
"workload_on_break": "Em pausa",
"workload_resume": "Retomar",
"workload_take_break": "Pausa"
```

**Step 3: Verify it compiles**

Run: `pnpm run check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/components/WorkStatusBar.svelte src/lib/paraglide/messages/
git commit -m "feat(WorkStatusBar): add break toggle status bar component"
```

---

### Task 2.3: Integrate WorkStatusBar into AppShell

**Files:**
- Modify: `src/lib/components/AppShell.svelte`

**Step 1: Import WorkStatusBar**

Add import at top of script:

```typescript
import WorkStatusBar from '$lib/components/WorkStatusBar.svelte';
```

**Step 2: Add WorkStatusBar before main content (courier only)**

Find the main content area and add the status bar for courier role:

```svelte
<!-- After mobile header, before main content -->
{#if role === 'courier'}
	<div class="md:hidden">
		<WorkStatusBar {supabase} courierId={profile.id} />
	</div>
{/if}
```

**Step 3: Add desktop version in sidebar area for courier**

In the desktop layout section, add:

```svelte
{#if role === 'courier'}
	<div class="hidden md:block border-b">
		<WorkStatusBar {supabase} courierId={profile.id} />
	</div>
{/if}
```

**Step 4: Verify it renders**

Run: `pnpm run dev`
Login as courier and verify status bar appears

**Step 5: Commit**

```bash
git add src/lib/components/AppShell.svelte
git commit -m "feat(AppShell): integrate WorkStatusBar for courier role"
```

---

## Phase 3: Workload Calculation & Dashboard

### Task 3.1: Workload Calculation Service

**Files:**
- Create: `src/lib/services/workload.ts`

**Step 1: Create the workload calculation service**

```typescript
/**
 * Workload Calculation Service
 * Calculates daily workload estimates for the courier.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Service, WorkloadSettings } from '$lib/database.types.js';
import { getBreakTimeForRange } from '$lib/services/breaks.js';

export interface WorkloadEstimate {
	totalServices: number;
	totalDistanceKm: number;
	drivingTimeMinutes: number;
	serviceTimeMinutes: number;
	breakTimeMinutes: number;
	totalTimeMinutes: number;
	availableMinutes: number;
	bufferMinutes: number;
	status: 'comfortable' | 'tight' | 'overloaded';
	services: ServiceWorkloadItem[];
}

export interface ServiceWorkloadItem {
	id: string;
	clientName: string;
	pickupLocation: string;
	deliveryLocation: string;
	distanceKm: number | null;
	drivingMinutes: number | null;
	serviceMinutes: number;
	scheduledTime: string | null;
}

const DEFAULT_WORKLOAD_SETTINGS: WorkloadSettings = {
	daily_hours: 8,
	default_service_time_minutes: 15,
	auto_lunch_start: '12:00',
	auto_lunch_end: '13:00',
	review_time: '18:00',
	learning_enabled: true,
	learned_service_time_minutes: null,
	learning_sample_count: 0
};

/**
 * Get workload settings from profile, with defaults
 */
export function getWorkloadSettings(profileSettings: unknown): WorkloadSettings {
	if (!profileSettings || typeof profileSettings !== 'object') {
		return DEFAULT_WORKLOAD_SETTINGS;
	}
	return { ...DEFAULT_WORKLOAD_SETTINGS, ...(profileSettings as Partial<WorkloadSettings>) };
}

/**
 * Get effective service time (learned or default)
 */
export function getEffectiveServiceTime(settings: WorkloadSettings): number {
	if (settings.learning_enabled && settings.learned_service_time_minutes !== null) {
		return settings.learned_service_time_minutes;
	}
	return settings.default_service_time_minutes;
}

/**
 * Calculate workload for a specific date
 */
export async function calculateDayWorkload(
	supabase: SupabaseClient,
	courierId: string,
	date: Date,
	settings: WorkloadSettings
): Promise<WorkloadEstimate> {
	// Get start and end of day
	const startOfDay = new Date(date);
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date(date);
	endOfDay.setHours(23, 59, 59, 999);

	const dateStr = date.toISOString().split('T')[0];

	// Fetch services for the day
	const { data: servicesData } = await supabase
		.from('services')
		.select('*, profiles!client_id(name)')
		.eq('scheduled_date', dateStr)
		.eq('status', 'pending')
		.is('deleted_at', null)
		.order('scheduled_time_slot');

	const services = (servicesData || []) as (Service & { profiles: { name: string } | null })[];

	// Get break time already logged for this day
	const breakTimeMinutes = await getBreakTimeForRange(supabase, courierId, startOfDay, endOfDay);

	// Calculate effective service time
	const serviceTimePerStop = getEffectiveServiceTime(settings);

	// Build service items and sum totals
	let totalDistanceKm = 0;
	let totalDrivingMinutes = 0;

	const serviceItems: ServiceWorkloadItem[] = services.map((s) => {
		const distanceKm = s.distance_km ?? null;
		// Estimate driving time: use stored value or estimate from distance
		const drivingMinutes = distanceKm ? Math.round((distanceKm / 30) * 60) : null;

		if (distanceKm) totalDistanceKm += distanceKm;
		if (drivingMinutes) totalDrivingMinutes += drivingMinutes;

		return {
			id: s.id,
			clientName: s.profiles?.name || 'Unknown',
			pickupLocation: s.pickup_location,
			deliveryLocation: s.delivery_location,
			distanceKm,
			drivingMinutes,
			serviceMinutes: serviceTimePerStop,
			scheduledTime: s.scheduled_time || null
		};
	});

	const serviceTimeMinutes = services.length * serviceTimePerStop;
	const totalTimeMinutes = totalDrivingMinutes + serviceTimeMinutes + breakTimeMinutes;
	const availableMinutes = settings.daily_hours * 60;
	const bufferMinutes = availableMinutes - totalTimeMinutes;

	let status: 'comfortable' | 'tight' | 'overloaded';
	if (bufferMinutes < 0) {
		status = 'overloaded';
	} else if (bufferMinutes < 60) {
		status = 'tight';
	} else {
		status = 'comfortable';
	}

	return {
		totalServices: services.length,
		totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
		drivingTimeMinutes: totalDrivingMinutes,
		serviceTimeMinutes,
		breakTimeMinutes,
		totalTimeMinutes,
		availableMinutes,
		bufferMinutes,
		status,
		services: serviceItems
	};
}
```

**Step 2: Verify types compile**

Run: `pnpm run check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/services/workload.ts
git commit -m "feat(workload): add workload calculation service"
```

---

### Task 3.2: WorkloadCard Component

**Files:**
- Create: `src/lib/components/WorkloadCard.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown, ChevronUp, Clock, MapPin, AlertTriangle, CheckCircle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { WorkloadEstimate } from '$lib/services/workload.js';

	interface Props {
		workload: WorkloadEstimate;
	}

	let { workload }: Props = $props();
	let expanded = $state(false);

	function formatTime(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours === 0) return `${mins}m`;
		if (mins === 0) return `${hours}h`;
		return `${hours}h ${mins}m`;
	}

	const statusConfig = $derived({
		comfortable: {
			icon: CheckCircle,
			color: 'text-green-600',
			bg: 'bg-green-50 dark:bg-green-950/30',
			message: m.workload_status_comfortable({ hours: formatTime(workload.bufferMinutes) })
		},
		tight: {
			icon: Clock,
			color: 'text-yellow-600',
			bg: 'bg-yellow-50 dark:bg-yellow-950/30',
			message: m.workload_status_tight({ hours: formatTime(workload.bufferMinutes) })
		},
		overloaded: {
			icon: AlertTriangle,
			color: 'text-red-600',
			bg: 'bg-red-50 dark:bg-red-950/30',
			message: m.workload_status_overloaded({ hours: formatTime(Math.abs(workload.bufferMinutes)) })
		}
	}[workload.status]);
</script>

<Card.Root class={statusConfig.bg}>
	<Card.Header class="pb-2">
		<Card.Title class="flex items-center gap-2 text-base">
			<svelte:component this={statusConfig.icon} class="size-5 {statusConfig.color}" />
			{m.workload_title()}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<div class="flex items-center gap-4 text-sm text-muted-foreground">
			<span>{workload.totalServices} {m.workload_services()}</span>
			<span>•</span>
			<span>{workload.totalDistanceKm} km</span>
		</div>

		<div class="space-y-1 text-sm">
			<div class="flex justify-between">
				<span class="text-muted-foreground">{m.workload_driving()}</span>
				<span>{formatTime(workload.drivingTimeMinutes)}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-muted-foreground">{m.workload_service_time()}</span>
				<span>{formatTime(workload.serviceTimeMinutes)}</span>
			</div>
			{#if workload.breakTimeMinutes > 0}
				<div class="flex justify-between">
					<span class="text-muted-foreground">{m.workload_breaks()}</span>
					<span>{formatTime(workload.breakTimeMinutes)}</span>
				</div>
			{/if}
			<div class="border-t pt-1 flex justify-between font-medium">
				<span>{m.workload_total_needed()}</span>
				<span>{formatTime(workload.totalTimeMinutes)}</span>
			</div>
		</div>

		<div class="flex items-center gap-2 pt-1 {statusConfig.color}">
			<svelte:component this={statusConfig.icon} class="size-4" />
			<span class="text-sm font-medium">{statusConfig.message}</span>
		</div>

		{#if workload.services.length > 0}
			<Collapsible.Root bind:open={expanded}>
				<Collapsible.Trigger asChild let:builder>
					<Button builders={[builder]} variant="ghost" size="sm" class="w-full mt-2">
						{expanded ? m.workload_hide_details() : m.workload_show_details()}
						{#if expanded}
							<ChevronUp class="size-4 ml-1" />
						{:else}
							<ChevronDown class="size-4 ml-1" />
						{/if}
					</Button>
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="space-y-2 mt-2 pt-2 border-t">
						{#each workload.services as service}
							<div class="text-xs space-y-0.5">
								<div class="font-medium">{service.clientName}</div>
								<div class="flex items-center gap-1 text-muted-foreground">
									<MapPin class="size-3" />
									<span class="truncate">{service.deliveryLocation}</span>
								</div>
								<div class="flex gap-2 text-muted-foreground">
									{#if service.distanceKm}
										<span>{service.distanceKm} km</span>
									{/if}
									{#if service.drivingMinutes}
										<span>~{service.drivingMinutes}m drive</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		{/if}
	</Card.Content>
</Card.Root>
```

**Step 2: Add i18n messages**

In `src/lib/paraglide/messages/en.json`:

```json
"workload_title": "Today's Workload",
"workload_services": "services",
"workload_driving": "Driving",
"workload_service_time": "Service time",
"workload_breaks": "Breaks",
"workload_total_needed": "Total needed",
"workload_status_comfortable": "Fits in day ({hours} buffer)",
"workload_status_tight": "Tight day ({hours} buffer)",
"workload_status_overloaded": "Overloaded by {hours}",
"workload_show_details": "Show details",
"workload_hide_details": "Hide details"
```

In `src/lib/paraglide/messages/pt-PT.json`:

```json
"workload_title": "Carga de Trabalho de Hoje",
"workload_services": "serviços",
"workload_driving": "Condução",
"workload_service_time": "Tempo de serviço",
"workload_breaks": "Pausas",
"workload_total_needed": "Total necessário",
"workload_status_comfortable": "Cabe no dia ({hours} de folga)",
"workload_status_tight": "Dia apertado ({hours} de folga)",
"workload_status_overloaded": "Excede em {hours}",
"workload_show_details": "Mostrar detalhes",
"workload_hide_details": "Esconder detalhes"
```

**Step 3: Verify it compiles**

Run: `pnpm run check`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/lib/components/WorkloadCard.svelte src/lib/paraglide/messages/
git commit -m "feat(WorkloadCard): add dashboard workload summary component"
```

---

### Task 3.3: Integrate WorkloadCard into Courier Dashboard

**Files:**
- Modify: `src/routes/courier/+page.svelte`
- Modify: `src/routes/courier/+page.server.ts` (or +page.ts if client-side loading)

**Step 1: Add workload data loading**

In the page's data loader, add workload calculation:

```typescript
import { calculateDayWorkload, getWorkloadSettings } from '$lib/services/workload.js';

// In load function:
const settings = getWorkloadSettings(profile.workload_settings);
const workload = await calculateDayWorkload(supabase, profile.id, new Date(), settings);

return {
	// ... existing data
	workload
};
```

**Step 2: Import and render WorkloadCard**

In `+page.svelte`:

```typescript
import WorkloadCard from '$lib/components/WorkloadCard.svelte';
```

Add to template, typically at the top of the dashboard:

```svelte
{#if data.workload}
	<WorkloadCard workload={data.workload} />
{/if}
```

**Step 3: Verify it renders**

Run: `pnpm run dev`
Login as courier and verify workload card appears on dashboard

**Step 4: Commit**

```bash
git add src/routes/courier/+page.svelte src/routes/courier/+page.server.ts
git commit -m "feat(dashboard): integrate WorkloadCard on courier dashboard"
```

---

## Phase 4-6: Remaining Features

The remaining phases follow the same pattern:

### Phase 4: Anomaly Detection
- Task 4.1: Create `AnomalyPrompt.svelte` dialog component
- Task 4.2: Add gap detection logic when marking service as delivered
- Task 4.3: Log delay reasons to `delivery_time_logs`

### Phase 5: Daily Review
- Task 5.1: Create `DailyReview.svelte` component
- Task 5.2: Create `/courier/review/[date]` route
- Task 5.3: Add daily review notification type
- Task 5.4: Add "review yesterday" banner to dashboard

### Phase 6: Learning System
- Task 6.1: Create learning calculation functions in `workload.ts`
- Task 6.2: Update profile's learned_service_time on each valid delivery
- Task 6.3: Add learning display in settings page
- Task 6.4: Add WorkloadSettingsTab to courier settings

---

## Testing Checklist

After each phase:

1. [ ] Type check passes: `pnpm run check`
2. [ ] Dev server runs: `pnpm run dev`
3. [ ] Feature works as expected in browser
4. [ ] No console errors
5. [ ] Works on mobile viewport
6. [ ] Commit made with descriptive message

---

## References

- Design document: `docs/plans/2026-01-28-workload-management-design.md`
- Existing services pattern: `src/lib/services/distance.ts`, `src/lib/services/route.ts`
- Existing component patterns: `src/lib/components/ServiceCard.svelte`
- Database types: `src/lib/database.types.ts`
