# Past Due System Phase 3 Implementation Plan

> **Status:** ✅ COMPLETE
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make past-due thresholds and client rescheduling policies configurable via courier settings.

**Architecture:**
- Add `past_due_settings` JSONB column to profiles table (courier only uses it)
- Create `PastDueSettings` TypeScript type
- Add `settingsToConfig()` helper to convert DB settings to `PastDueConfig`
- Add settings UI sections for "Delivery Deadlines" and "Client Rescheduling"
- Wire settings through layout to ALL courier pages (dashboard, services list, service detail, calendar)

**Tech Stack:** SvelteKit, Svelte 5, Supabase, shadcn-svelte, existing past-due utilities

**Tasks:** 12 total (1-10 + 9.5, 9.6)

---

## Task 1: Create Database Migration for Settings

**Files:**
- Create: `supabase/migrations/025_add_past_due_settings.sql`

**Step 1: Write migration SQL**

```sql
-- Add past due settings to profiles (courier configuration)
-- These settings control urgency thresholds and client rescheduling policies

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

-- Add comment for documentation
COMMENT ON COLUMN profiles.past_due_settings IS 'Courier-configurable past due thresholds and client rescheduling policies';
```

**Step 2: Apply migration via Supabase MCP**

Run:
```
mcp__supabase__apply_migration(
  name: "add_past_due_settings",
  query: <migration SQL above>
)
```

**Step 3: Verify migration applied**

Run:
```
mcp__supabase__execute_sql(
  query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'past_due_settings'"
)
```

Expected: One row with `past_due_settings` and `jsonb`

**Step 4: Commit**

```bash
git add supabase/migrations/025_add_past_due_settings.sql
git commit -m "db: Add past_due_settings JSONB column to profiles"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts`
- Modify: `src/lib/utils/past-due.ts`

**Step 1: Add PastDueSettings type to database.types.ts**

After the `PriceBreakdown` type (around line 12), add:

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
};
```

**Step 2: Add past_due_settings to Profile Row type**

In the `profiles.Row` type (around line 39), add after `round_distance`:

```typescript
// Past due settings (Phase 3 Past Due)
past_due_settings: PastDueSettings | null;
```

**Step 3: Add past_due_settings to Profile Insert type**

In the `profiles.Insert` type (around line 57), add:

```typescript
past_due_settings?: PastDueSettings | null;
```

**Step 4: Add past_due_settings to Profile Update type**

In the `profiles.Update` type (around line 75), add:

```typescript
past_due_settings?: PastDueSettings | null;
```

**Step 5: Add settingsToConfig helper to past-due.ts**

At the end of `src/lib/utils/past-due.ts` (after `sortByUrgency`), add:

```typescript
/**
 * Convert database PastDueSettings to PastDueConfig for calculations.
 * Merges user settings with defaults, preserving timeSlots from defaults.
 */
export function settingsToConfig(settings: {
	gracePeriodStandard?: number;
	gracePeriodSpecific?: number;
	thresholdApproaching?: number;
	thresholdUrgent?: number;
	thresholdCriticalHours?: number;
} | null): PastDueConfig {
	if (!settings) return DEFAULT_CONFIG;

	return {
		timeSlots: DEFAULT_CONFIG.timeSlots, // Time slots are not user-configurable
		gracePeriodStandard: settings.gracePeriodStandard ?? DEFAULT_CONFIG.gracePeriodStandard,
		gracePeriodSpecific: settings.gracePeriodSpecific ?? DEFAULT_CONFIG.gracePeriodSpecific,
		thresholdApproaching: settings.thresholdApproaching ?? DEFAULT_CONFIG.thresholdApproaching,
		thresholdUrgent: settings.thresholdUrgent ?? DEFAULT_CONFIG.thresholdUrgent,
		thresholdCriticalHours: settings.thresholdCriticalHours ?? DEFAULT_CONFIG.thresholdCriticalHours
	};
}
```

**Step 6: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 7: Commit**

```bash
git add src/lib/database.types.ts src/lib/utils/past-due.ts
git commit -m "types: Add PastDueSettings type and settingsToConfig helper"
```

---

## Task 3: Load Settings in Courier Layout

**Files:**
- Modify: `src/routes/courier/+layout.server.ts:32-37`

**Step 1: Include past_due_settings in returned profile**

Change the return statement (around line 32) from:

```typescript
return {
	profile: { id: profile.id, role: profile.role, name: profile.name },
	navCounts: {
		pendingRequests: pendingRequestsResult.count ?? 0
	}
};
```

To:

```typescript
return {
	profile: {
		id: profile.id,
		role: profile.role,
		name: profile.name,
		past_due_settings: profile.past_due_settings
	},
	navCounts: {
		pendingRequests: pendingRequestsResult.count ?? 0
	}
};
```

**Step 2: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/courier/+layout.server.ts
git commit -m "feat(past-due): Load past_due_settings in courier layout"
```

---

## Task 4: Add Translations for Settings UI

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English translations**

Add after `"reschedule_error"` (around line 417):

```json
,
"settings_delivery_deadlines": "Delivery Deadlines",
"settings_delivery_deadlines_desc": "Configure when services are marked as approaching, urgent, or past due",
"settings_grace_period_standard": "Grace period (time slots)",
"settings_grace_period_standard_desc": "Minutes after slot end before marking as late",
"settings_grace_period_specific": "Grace period (specific time)",
"settings_grace_period_specific_desc": "Minutes after specific time before marking as late",
"settings_threshold_approaching": "Approaching threshold",
"settings_threshold_approaching_desc": "Minutes before deadline to show 'Due Soon' warning",
"settings_threshold_urgent": "Urgent threshold",
"settings_threshold_urgent_desc": "Minutes before deadline to show 'Urgent' warning",
"settings_threshold_critical": "Critical threshold",
"settings_threshold_critical_desc": "Hours after past due to mark as 'Critical'",
"settings_client_rescheduling": "Client Rescheduling",
"settings_client_rescheduling_desc": "Control whether and how clients can request reschedules",
"settings_allow_client_reschedule": "Allow clients to reschedule",
"settings_allow_client_reschedule_desc": "Clients can request date/time changes for pending services",
"settings_client_min_notice": "Minimum notice (hours)",
"settings_client_min_notice_desc": "How many hours before scheduled time clients must request changes",
"settings_client_max_reschedules": "Maximum reschedules",
"settings_client_max_reschedules_desc": "Maximum number of times a service can be rescheduled",
"settings_minutes": "min",
"settings_hours": "hours"
```

**Step 2: Add Portuguese translations**

Add after `"reschedule_error"` (around line 417):

```json
,
"settings_delivery_deadlines": "Prazos de Entrega",
"settings_delivery_deadlines_desc": "Configure quando os serviços são marcados como próximos, urgentes ou em atraso",
"settings_grace_period_standard": "Período de tolerância (períodos)",
"settings_grace_period_standard_desc": "Minutos após o fim do período antes de marcar como atrasado",
"settings_grace_period_specific": "Período de tolerância (hora específica)",
"settings_grace_period_specific_desc": "Minutos após hora específica antes de marcar como atrasado",
"settings_threshold_approaching": "Limiar de aproximação",
"settings_threshold_approaching_desc": "Minutos antes do prazo para mostrar aviso 'A Vencer'",
"settings_threshold_urgent": "Limiar de urgência",
"settings_threshold_urgent_desc": "Minutos antes do prazo para mostrar aviso 'Urgente'",
"settings_threshold_critical": "Limiar crítico",
"settings_threshold_critical_desc": "Horas após atraso para marcar como 'Crítico'",
"settings_client_rescheduling": "Reagendamento por Clientes",
"settings_client_rescheduling_desc": "Controle se e como os clientes podem solicitar reagendamentos",
"settings_allow_client_reschedule": "Permitir reagendamento por clientes",
"settings_allow_client_reschedule_desc": "Clientes podem solicitar alterações de data/hora para serviços pendentes",
"settings_client_min_notice": "Aviso mínimo (horas)",
"settings_client_min_notice_desc": "Quantas horas antes do horário agendado os clientes devem solicitar alterações",
"settings_client_max_reschedules": "Máximo de reagendamentos",
"settings_client_max_reschedules_desc": "Número máximo de vezes que um serviço pode ser reagendado",
"settings_minutes": "min",
"settings_hours": "horas"
```

**Step 3: Regenerate Paraglide messages**

Run:
```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide
```

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "i18n: Add translations for past due settings"
```

---

## Task 5: Add Settings UI Sections

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte`

**Step 1: Add Clock icon import**

Update the imports (around line 13) to add `Clock`:

```typescript
import { Settings, User, Zap, Plus, Trash2, Power, Bell, MapPin, Warehouse, Calculator, Clock } from '@lucide/svelte';
```

**Step 2: Add PastDueSettings type import**

After the existing imports (around line 11), add:

```typescript
import type { PageData, ActionData } from './$types';
import type { PastDueSettings } from '$lib/database.types.js';
```

Note: `PageData` and `ActionData` may already be imported; just ensure `PastDueSettings` is added.

**Step 3: Add state for past due settings**

After the `roundDistance` state (around line 64), add:

```typescript
// Past due settings state
const defaultPastDueSettings: PastDueSettings = {
	gracePeriodStandard: 30,
	gracePeriodSpecific: 15,
	thresholdApproaching: 120,
	thresholdUrgent: 60,
	thresholdCriticalHours: 24,
	allowClientReschedule: true,
	clientMinNoticeHours: 24,
	clientMaxReschedules: 3
};
// svelte-ignore state_referenced_locally
let pastDueSettings = $state<PastDueSettings>(
	data.profile.past_due_settings ?? defaultPastDueSettings
);
```

**Step 4: Add Delivery Deadlines Card**

After the Pricing Preferences Card (around line 421, after `</Card.Root>`), add before `<Separator />`:

```svelte
<!-- Delivery Deadlines -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Clock class="size-5" />
			{m.settings_delivery_deadlines()}
		</Card.Title>
		<Card.Description>{m.settings_delivery_deadlines_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updatePastDueSettings" use:enhance class="space-y-6">
			<!-- Grace period (standard) -->
			<div class="space-y-2">
				<Label for="gracePeriodStandard">{m.settings_grace_period_standard()}</Label>
				<div class="flex items-center gap-2">
					<Input
						id="gracePeriodStandard"
						name="gracePeriodStandard"
						type="number"
						min="0"
						max="60"
						bind:value={pastDueSettings.gracePeriodStandard}
						class="w-24"
					/>
					<span class="text-sm text-muted-foreground">{m.settings_minutes()}</span>
				</div>
				<p class="text-xs text-muted-foreground">{m.settings_grace_period_standard_desc()}</p>
			</div>

			<!-- Grace period (specific) -->
			<div class="space-y-2">
				<Label for="gracePeriodSpecific">{m.settings_grace_period_specific()}</Label>
				<div class="flex items-center gap-2">
					<Input
						id="gracePeriodSpecific"
						name="gracePeriodSpecific"
						type="number"
						min="0"
						max="30"
						bind:value={pastDueSettings.gracePeriodSpecific}
						class="w-24"
					/>
					<span class="text-sm text-muted-foreground">{m.settings_minutes()}</span>
				</div>
				<p class="text-xs text-muted-foreground">{m.settings_grace_period_specific_desc()}</p>
			</div>

			<Separator />

			<!-- Approaching threshold -->
			<div class="space-y-2">
				<Label for="thresholdApproaching">{m.settings_threshold_approaching()}</Label>
				<div class="flex items-center gap-2">
					<Input
						id="thresholdApproaching"
						name="thresholdApproaching"
						type="number"
						min="30"
						max="180"
						bind:value={pastDueSettings.thresholdApproaching}
						class="w-24"
					/>
					<span class="text-sm text-muted-foreground">{m.settings_minutes()}</span>
				</div>
				<p class="text-xs text-muted-foreground">{m.settings_threshold_approaching_desc()}</p>
			</div>

			<!-- Urgent threshold -->
			<div class="space-y-2">
				<Label for="thresholdUrgent">{m.settings_threshold_urgent()}</Label>
				<div class="flex items-center gap-2">
					<Input
						id="thresholdUrgent"
						name="thresholdUrgent"
						type="number"
						min="15"
						max="120"
						bind:value={pastDueSettings.thresholdUrgent}
						class="w-24"
					/>
					<span class="text-sm text-muted-foreground">{m.settings_minutes()}</span>
				</div>
				<p class="text-xs text-muted-foreground">{m.settings_threshold_urgent_desc()}</p>
			</div>

			<!-- Critical threshold -->
			<div class="space-y-2">
				<Label for="thresholdCriticalHours">{m.settings_threshold_critical()}</Label>
				<div class="flex items-center gap-2">
					<Input
						id="thresholdCriticalHours"
						name="thresholdCriticalHours"
						type="number"
						min="1"
						max="72"
						bind:value={pastDueSettings.thresholdCriticalHours}
						class="w-24"
					/>
					<span class="text-sm text-muted-foreground">{m.settings_hours()}</span>
				</div>
				<p class="text-xs text-muted-foreground">{m.settings_threshold_critical_desc()}</p>
			</div>

			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>

<!-- Client Rescheduling -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Clock class="size-5" />
			{m.settings_client_rescheduling()}
		</Card.Title>
		<Card.Description>{m.settings_client_rescheduling_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updateClientRescheduleSettings" use:enhance class="space-y-6">
			<!-- Allow client reschedule toggle -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Label>{m.settings_allow_client_reschedule()}</Label>
					<p class="text-sm text-muted-foreground">{m.settings_allow_client_reschedule_desc()}</p>
				</div>
				<input type="hidden" name="allowClientReschedule" value={pastDueSettings.allowClientReschedule.toString()} />
				<Switch
					checked={pastDueSettings.allowClientReschedule}
					onCheckedChange={(checked) => {
						pastDueSettings.allowClientReschedule = checked;
					}}
				/>
			</div>

			{#if pastDueSettings.allowClientReschedule}
				<Separator />

				<!-- Minimum notice hours -->
				<div class="space-y-2">
					<Label for="clientMinNoticeHours">{m.settings_client_min_notice()}</Label>
					<div class="flex items-center gap-2">
						<Input
							id="clientMinNoticeHours"
							name="clientMinNoticeHours"
							type="number"
							min="1"
							max="72"
							bind:value={pastDueSettings.clientMinNoticeHours}
							class="w-24"
						/>
						<span class="text-sm text-muted-foreground">{m.settings_hours()}</span>
					</div>
					<p class="text-xs text-muted-foreground">{m.settings_client_min_notice_desc()}</p>
				</div>

				<!-- Max reschedules -->
				<div class="space-y-2">
					<Label for="clientMaxReschedules">{m.settings_client_max_reschedules()}</Label>
					<Input
						id="clientMaxReschedules"
						name="clientMaxReschedules"
						type="number"
						min="1"
						max="10"
						bind:value={pastDueSettings.clientMaxReschedules}
						class="w-24"
					/>
					<p class="text-xs text-muted-foreground">{m.settings_client_max_reschedules_desc()}</p>
				</div>
			{/if}

			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>

<Separator />
```

**Step 5: Commit**

```bash
git add src/routes/courier/settings/+page.svelte
git commit -m "feat(past-due): Add settings UI for delivery deadlines and client rescheduling"
```

---

## Task 6: Add Server Actions for Settings

**Files:**
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Add updatePastDueSettings action**

At the end of the actions object (after `updatePricingPreferences` around line 333), add:

```typescript
,
updatePastDueSettings: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return { success: false, error: 'Not authenticated' };
	}

	const formData = await request.formData();

	// Helper to parse int with bounds validation (handles 0 correctly, unlike || default)
	const parseIntWithBounds = (value: FormDataEntryValue | null, min: number, max: number, defaultVal: number): number => {
		if (value === null || value === '') return defaultVal;
		const parsed = parseInt(value as string, 10);
		if (Number.isNaN(parsed)) return defaultVal;
		return Math.max(min, Math.min(max, parsed));
	};

	const gracePeriodStandard = parseIntWithBounds(formData.get('gracePeriodStandard'), 0, 60, 30);
	const gracePeriodSpecific = parseIntWithBounds(formData.get('gracePeriodSpecific'), 0, 30, 15);
	const thresholdApproaching = parseIntWithBounds(formData.get('thresholdApproaching'), 30, 180, 120);
	const thresholdUrgent = parseIntWithBounds(formData.get('thresholdUrgent'), 15, 120, 60);
	const thresholdCriticalHours = parseIntWithBounds(formData.get('thresholdCriticalHours'), 1, 72, 24);

	// Get current settings to preserve client reschedule fields
	const { data: currentProfile } = await supabase
		.from('profiles')
		.select('past_due_settings')
		.eq('id', user.id)
		.single();

	const currentSettings = (currentProfile as { past_due_settings: Record<string, unknown> | null })?.past_due_settings || {};

	const updatedSettings = {
		...currentSettings,
		gracePeriodStandard,
		gracePeriodSpecific,
		thresholdApproaching,
		thresholdUrgent,
		thresholdCriticalHours
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error } = await (supabase as any)
		.from('profiles')
		.update({ past_due_settings: updatedSettings })
		.eq('id', user.id);

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true, message: 'past_due_settings_updated' };
},

updateClientRescheduleSettings: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return { success: false, error: 'Not authenticated' };
	}

	const formData = await request.formData();
	const allowClientReschedule = formData.get('allowClientReschedule') === 'true';

	// Helper to parse int with bounds validation
	const parseIntWithBounds = (value: FormDataEntryValue | null, min: number, max: number, defaultVal: number): number => {
		if (value === null || value === '') return defaultVal;
		const parsed = parseInt(value as string, 10);
		if (Number.isNaN(parsed)) return defaultVal;
		return Math.max(min, Math.min(max, parsed));
	};

	const clientMinNoticeHours = parseIntWithBounds(formData.get('clientMinNoticeHours'), 1, 72, 24);
	const clientMaxReschedules = parseIntWithBounds(formData.get('clientMaxReschedules'), 1, 10, 3);

	// Get current settings to preserve threshold fields
	const { data: currentProfile } = await supabase
		.from('profiles')
		.select('past_due_settings')
		.eq('id', user.id)
		.single();

	const currentSettings = (currentProfile as { past_due_settings: Record<string, unknown> | null })?.past_due_settings || {};

	const updatedSettings = {
		...currentSettings,
		allowClientReschedule,
		clientMinNoticeHours,
		clientMaxReschedules
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error } = await (supabase as any)
		.from('profiles')
		.update({ past_due_settings: updatedSettings })
		.eq('id', user.id);

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true, message: 'client_reschedule_settings_updated' };
}
```

**Step 2: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/routes/courier/settings/+page.server.ts
git commit -m "feat(past-due): Add server actions for past due settings"
```

---

## Task 7: Update UrgencyBadge to Accept Config

**Files:**
- Modify: `src/lib/components/UrgencyBadge.svelte`

**Step 1: Update imports to include PastDueConfig**

Change the import (around line 6) from:

```typescript
import {
	calculateUrgency,
	getTimeRemaining,
	type ServiceForUrgency,
	type UrgencyLevel
} from '$lib/utils/past-due.js';
```

To:

```typescript
import {
	calculateUrgency,
	getTimeRemaining,
	type ServiceForUrgency,
	type UrgencyLevel,
	type PastDueConfig
} from '$lib/utils/past-due.js';
```

**Step 2: Add config prop**

Update the interface (around line 12) from:

```typescript
interface UrgencyBadgeProps {
	service: ServiceForUrgency;
	showTimeRemaining?: boolean;
	size?: 'sm' | 'default';
}
```

To:

```typescript
interface UrgencyBadgeProps {
	service: ServiceForUrgency;
	showTimeRemaining?: boolean;
	size?: 'sm' | 'default';
	config?: PastDueConfig;
}
```

**Step 3: Update props destructuring**

Change (around line 18) from:

```typescript
let { service, showTimeRemaining = false, size = 'default' }: UrgencyBadgeProps = $props();
```

To:

```typescript
let { service, showTimeRemaining = false, size = 'default', config }: UrgencyBadgeProps = $props();
```

**Step 4: Pass config to calculations**

Change the derived values (around line 20) from:

```typescript
const urgency = $derived(calculateUrgency(service));
const timeRemaining = $derived(showTimeRemaining ? getTimeRemaining(service) : null);
```

To:

```typescript
const urgency = $derived(calculateUrgency(service, config));
const timeRemaining = $derived(showTimeRemaining ? getTimeRemaining(service, config) : null);
```

**Step 5: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 6: Commit**

```bash
git add src/lib/components/UrgencyBadge.svelte
git commit -m "feat(past-due): Accept config prop in UrgencyBadge"
```

---

## Task 8: Wire Settings to Dashboard

**Files:**
- Modify: `src/routes/courier/+page.svelte`

**Step 1: Add settingsToConfig import**

Update the past-due import (around line 15) from:

```typescript
import { sortByUrgency } from '$lib/utils/past-due.js';
```

To:

```typescript
import { sortByUrgency, settingsToConfig, type PastDueConfig } from '$lib/utils/past-due.js';
```

**Step 2: Create config derived value**

After the imports, find where `data` is accessed and add (around line 25, after props):

```typescript
const pastDueConfig = $derived(settingsToConfig(data.profile.past_due_settings));
```

**Step 3: Pass config to sortByUrgency**

Find the `sortedServices` derived (around line 166) and change from:

```typescript
const sortedServices = $derived(sortByUrgency(services));
```

To:

```typescript
const sortedServices = $derived(sortByUrgency(services, pastDueConfig));
```

**Step 4: Pass config to UrgencyBadge components**

Find all `<UrgencyBadge` instances and add the config prop:

```svelte
<UrgencyBadge service={service} size="sm" config={pastDueConfig} />
```

**Step 5: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 6: Commit**

```bash
git add src/routes/courier/+page.svelte
git commit -m "feat(past-due): Wire settings to dashboard urgency calculation"
```

---

## Task 9: Wire Settings to Services List

**Files:**
- Modify: `src/routes/courier/services/+page.svelte`

**Step 1: Add settingsToConfig import**

Update the past-due import (around line 22) from:

```typescript
import { sortByUrgency } from '$lib/utils/past-due.js';
```

To:

```typescript
import { sortByUrgency, settingsToConfig, type PastDueConfig } from '$lib/utils/past-due.js';
```

**Step 2: Create config derived value**

After the data props, add:

```typescript
const pastDueConfig = $derived(settingsToConfig(data.profile.past_due_settings));
```

Note: You may need to access `data.profile` from layout data. Check how `data` is structured.

**Step 3: Pass config to sortByUrgency in filteredServices**

Find the `filteredServices` derived (around line 212) and update the `sortByUrgency` call to include config:

```typescript
const filteredServices = $derived(
	sortByUrgency(
		services.filter((s) => {
			// existing filter logic
		}),
		pastDueConfig
	)
);
```

**Step 4: Pass config to UrgencyBadge components**

Find all `<UrgencyBadge` instances and add the config prop:

```svelte
<UrgencyBadge service={service} size="sm" config={pastDueConfig} />
```

**Step 5: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 6: Commit**

```bash
git add src/routes/courier/services/+page.svelte
git commit -m "feat(past-due): Wire settings to services list urgency calculation"
```

---

## Task 9.5: Wire Settings to Service Detail Page

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.svelte`

**Step 1: Add settingsToConfig import**

Update or add the past-due import:

```typescript
import { settingsToConfig, type PastDueConfig } from '$lib/utils/past-due.js';
```

**Step 2: Create config derived value**

After the data props (around line 33), add:

```typescript
// Access layout profile data for past due config
const pastDueConfig = $derived(settingsToConfig(data.profile?.past_due_settings));
```

Note: Layout data is merged with page data in SvelteKit, so `data.profile` from the layout is accessible.

**Step 3: Pass config to UrgencyBadge**

Find the `<UrgencyBadge` instance (around line 205) and change from:

```svelte
<UrgencyBadge {service} />
```

To:

```svelte
<UrgencyBadge {service} config={pastDueConfig} />
```

**Step 4: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 5: Commit**

```bash
git add "src/routes/courier/services/[id]/+page.svelte"
git commit -m "feat(past-due): Wire settings to service detail page"
```

---

## Task 9.6: Wire Settings to Calendar Page

**Files:**
- Modify: `src/routes/courier/calendar/+page.svelte`

**Step 1: Add settingsToConfig import**

After the existing imports (around line 12), add:

```typescript
import { settingsToConfig, type PastDueConfig } from '$lib/utils/past-due.js';
```

**Step 2: Create config derived value**

After the data props (around line 14), add:

```typescript
// Access layout profile data for past due config
const pastDueConfig = $derived(settingsToConfig(data.profile?.past_due_settings));
```

**Step 3: Pass config to UrgencyBadge**

Find the `<UrgencyBadge` instance (around line 319) and change from:

```svelte
<UrgencyBadge {service} size="sm" />
```

To:

```svelte
<UrgencyBadge {service} size="sm" config={pastDueConfig} />
```

**Step 4: Type check**

Run: `pnpm run check`
Expected: No errors

**Step 5: Commit**

```bash
git add src/routes/courier/calendar/+page.svelte
git commit -m "feat(past-due): Wire settings to calendar page"
```

---

## Task 10: Final Verification

**Step 1: Type check**

Run: `pnpm run check`
Expected: 0 errors, 0 warnings

**Step 2: Run security advisor**

Run:
```
mcp__supabase__get_advisors(type: "security")
```

Expected: No new security issues from past_due_settings changes

**Step 3: Manual testing checklist**

- [ ] Navigate to Settings page
- [ ] "Delivery Deadlines" card appears with threshold inputs
- [ ] "Client Rescheduling" card appears with toggle and inputs
- [ ] Change grace period to 0, click Save - value persists as 0 (not default)
- [ ] Reload page - all values persist correctly
- [ ] Toggle "Allow clients to reschedule" - conditional fields show/hide
- [ ] Change rescheduling settings, click Save
- [ ] Navigate to Dashboard
- [ ] Urgency badges reflect new thresholds
- [ ] Services are sorted by urgency correctly
- [ ] Navigate to Services list
- [ ] Urgency badges and sorting work with settings
- [ ] Navigate to Calendar page
- [ ] Urgency badges work with settings
- [ ] Navigate to Service Detail page (click any service)
- [ ] Urgency badge works with settings

**Step 4: Update full implementation plan**

Mark Phase 3 as complete in `docs/plans/2026-01-25-past-due-full-implementation.md`:

Change:
```
| 3 | 5 | 1 migration | Not started |
```

To:
```
| 3 | 5 | 1 migration | ✅ Complete |
```

**Step 5: Commit documentation update**

```bash
git add docs/plans/
git commit -m "docs: Mark Phase 3 past due implementation complete"
```

---

## Summary

After completing these tasks:
- Courier can configure urgency thresholds in Settings
- Courier can control client rescheduling policies
- Settings persist in database as JSONB
- All urgency calculations use courier's custom thresholds
- UrgencyBadge and sortByUrgency respect configuration across ALL courier pages

**Database Changes:**
- Migration 025: adds `past_due_settings` JSONB column to profiles

**New/Modified Files:**
- `src/lib/database.types.ts` - PastDueSettings type, Profile field
- `src/lib/utils/past-due.ts` - settingsToConfig() helper
- `src/lib/components/UrgencyBadge.svelte` - accepts config prop
- `src/routes/courier/+layout.server.ts` - returns past_due_settings
- `src/routes/courier/settings/+page.svelte` - two new Card sections
- `src/routes/courier/settings/+page.server.ts` - two new actions (with bounds validation)
- `src/routes/courier/+page.svelte` - wired to settings
- `src/routes/courier/services/+page.svelte` - wired to settings
- `src/routes/courier/services/[id]/+page.svelte` - wired to settings
- `src/routes/courier/calendar/+page.svelte` - wired to settings
- `messages/en.json` - 18 new translations
- `messages/pt-PT.json` - 18 new translations

**Review-Driven Fixes Applied:**
1. Added Tasks 9.5 & 9.6 to wire settings to service detail and calendar pages
2. Fixed `parseInt` fallback to use `Number.isNaN()` check (handles 0 correctly)
3. Added server-side bounds validation with min/max enforcement

**Next Phase:** Phase 4 will add client-initiated reschedule requests with approval workflow.
