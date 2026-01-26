# Phase 4: Client Reschedule Workflow - Implementation Plan

> **Status:** ✅ COMPLETE
>
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow clients to request reschedules with approval workflow, respecting courier's configurable policies.

**Architecture:** Clients can request reschedules from their service detail page. If the request meets the courier's policy (enough notice, under max reschedules), it auto-approves. Otherwise, it creates a pending request that the courier must approve/deny. All reschedule history is tracked for audit.

**Tech Stack:** SvelteKit, Supabase (migrations + RLS), Svelte 5 runes, shadcn-svelte

---

## Task 1: Create Reschedule History Table

**Files:**
- Create: `supabase/migrations/026_create_reschedule_history.sql`

**Step 1: Write the migration**

```sql
-- Track reschedule requests and approvals
CREATE TABLE IF NOT EXISTS service_reschedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  initiated_by uuid REFERENCES profiles(id) NOT NULL,
  initiated_by_role text NOT NULL CHECK (initiated_by_role IN ('courier', 'client')),
  old_date date,
  old_time_slot text,
  old_time text,
  new_date date NOT NULL,
  new_time_slot text NOT NULL,
  new_time text,
  reason text,
  approval_status text DEFAULT 'auto_approved'
    CHECK (approval_status IN ('auto_approved', 'pending', 'approved', 'denied')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  denial_reason text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_reschedule_history_service ON service_reschedule_history(service_id);
CREATE INDEX idx_reschedule_history_pending ON service_reschedule_history(approval_status)
  WHERE approval_status = 'pending';

-- Enable RLS
ALTER TABLE service_reschedule_history ENABLE ROW LEVEL SECURITY;

-- Courier can see all, client can see their own services' history
CREATE POLICY reschedule_history_select ON service_reschedule_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'courier')
    OR EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_reschedule_history.service_id
      AND s.client_id = (SELECT auth.uid())
    )
  );

-- Anyone can insert their own reschedule requests
CREATE POLICY reschedule_history_insert ON service_reschedule_history
  FOR INSERT WITH CHECK (initiated_by = (SELECT auth.uid()));

-- Only courier can update (for approval/denial)
CREATE POLICY reschedule_history_update ON service_reschedule_history
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'courier')
  );
```

**Step 2: Apply migration via MCP**

Run: `mcp__supabase__apply_migration(name: "create_reschedule_history", query: [SQL above])`

**Step 3: Create local file and commit**

```bash
git add supabase/migrations/026_create_reschedule_history.sql
git commit -m "db: Create service_reschedule_history table"
```

**Verification:** `mcp__supabase__list_tables({ schemas: ["public"] })` should include `service_reschedule_history`

---

## Task 2: Add Pending Reschedule Fields to Services

**Files:**
- Create: `supabase/migrations/027_add_pending_reschedule_fields.sql`

**Step 1: Write the migration**

```sql
-- Add fields for pending client reschedule requests
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_date date;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_time_slot text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_time text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_reason text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_requested_at timestamptz;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_requested_by uuid REFERENCES profiles(id);

-- Comment for documentation
COMMENT ON COLUMN services.pending_reschedule_date IS 'Client-requested reschedule date awaiting courier approval';
```

**Step 2: Apply migration via MCP**

Run: `mcp__supabase__apply_migration(name: "add_pending_reschedule_fields", query: [SQL above])`

**Step 3: Create local file and commit**

```bash
git add supabase/migrations/027_add_pending_reschedule_fields.sql
git commit -m "db: Add pending reschedule fields to services"
```

---

## Task 3: Update TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts`

**Step 1: Add ServiceRescheduleHistory type after PastDueSettings (around line 25)**

```typescript
// Phase 4 Past Due: Reschedule history tracking
export type ServiceRescheduleHistory = {
	id: string;
	service_id: string;
	initiated_by: string;
	initiated_by_role: 'courier' | 'client';
	old_date: string | null;
	old_time_slot: string | null;
	old_time: string | null;
	new_date: string;
	new_time_slot: string;
	new_time: string | null;
	reason: string | null;
	approval_status: 'auto_approved' | 'pending' | 'approved' | 'denied';
	approved_by: string | null;
	approved_at: string | null;
	denial_reason: string | null;
	created_at: string;
};
```

**Step 2: Add pending reschedule fields to Service type Row (around line 130, after reschedule tracking fields)**

```typescript
					// Pending reschedule request (Phase 4 Past Due)
					pending_reschedule_date: string | null;
					pending_reschedule_time_slot: string | null;
					pending_reschedule_time: string | null;
					pending_reschedule_reason: string | null;
					pending_reschedule_requested_at: string | null;
					pending_reschedule_requested_by: string | null;
```

**Step 3: Add same fields to Service Insert and Update types**

**Step 4: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "types: Add ServiceRescheduleHistory and pending reschedule fields"
```

**Verification:** Run `pnpm run check` - should have 0 errors

---

## Task 4: Add Translations

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English translations (after line 440)**

```json
,
"client_request_reschedule": "Request Reschedule",
"client_request_reschedule_desc": "Ask the courier to change the delivery date",
"client_reschedule_reason": "Reason for reschedule",
"client_reschedule_reason_placeholder": "Optional: explain why you need to reschedule",
"client_reschedule_pending": "Reschedule Pending",
"client_reschedule_pending_desc": "Waiting for courier approval",
"client_reschedule_not_allowed": "Reschedule not available",
"client_reschedule_max_reached": "Maximum reschedules reached for this service",
"client_reschedule_too_late": "Too late to reschedule - minimum {hours} hours notice required",
"client_reschedule_disabled": "Rescheduling is not enabled for this service",
"client_reschedule_success": "Reschedule request submitted",
"client_reschedule_auto_approved": "Reschedule approved automatically",
"courier_pending_reschedules": "Pending Reschedules",
"courier_pending_reschedules_desc": "Client requests awaiting your approval",
"courier_approve_reschedule": "Approve",
"courier_deny_reschedule": "Deny",
"courier_deny_reason": "Reason for denial",
"courier_deny_reason_placeholder": "Optional: explain why you're denying",
"reschedule_approved": "Reschedule approved",
"reschedule_denied": "Reschedule denied",
"reschedule_history": "Reschedule History",
"reschedule_by_client": "Requested by client",
"reschedule_by_courier": "Changed by courier"
```

**Step 2: Add Portuguese translations (after line 440)**

```json
,
"client_request_reschedule": "Pedir Reagendamento",
"client_request_reschedule_desc": "Pedir ao estafeta para alterar a data de entrega",
"client_reschedule_reason": "Motivo do reagendamento",
"client_reschedule_reason_placeholder": "Opcional: explique porque precisa reagendar",
"client_reschedule_pending": "Reagendamento Pendente",
"client_reschedule_pending_desc": "A aguardar aprovação do estafeta",
"client_reschedule_not_allowed": "Reagendamento não disponível",
"client_reschedule_max_reached": "Número máximo de reagendamentos atingido para este serviço",
"client_reschedule_too_late": "Tarde demais para reagendar - são necessárias {hours} horas de antecedência mínima",
"client_reschedule_disabled": "O reagendamento não está ativado para este serviço",
"client_reschedule_success": "Pedido de reagendamento submetido",
"client_reschedule_auto_approved": "Reagendamento aprovado automaticamente",
"courier_pending_reschedules": "Reagendamentos Pendentes",
"courier_pending_reschedules_desc": "Pedidos de clientes a aguardar a sua aprovação",
"courier_approve_reschedule": "Aprovar",
"courier_deny_reschedule": "Recusar",
"courier_deny_reason": "Motivo da recusa",
"courier_deny_reason_placeholder": "Opcional: explique porque está a recusar",
"reschedule_approved": "Reagendamento aprovado",
"reschedule_denied": "Reagendamento recusado",
"reschedule_history": "Histórico de Reagendamentos",
"reschedule_by_client": "Pedido pelo cliente",
"reschedule_by_courier": "Alterado pelo estafeta"
```

**Step 3: Regenerate Paraglide messages**

```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide
```

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "i18n: Add Phase 4 reschedule workflow translations"
```

---

## Task 5: Create Client Reschedule Request Action

**Files:**
- Create: `src/routes/client/services/[id]/+page.server.ts`

**Step 1: Create the server file with load and action**

```typescript
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, ServiceStatusHistory } from '$lib/database.types';
import { localizeHref, extractLocaleFromRequest } from '$lib/paraglide/runtime.js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load service (RLS ensures client can only see their own)
	const { data: service, error: serviceError } = await supabase
		.from('services')
		.select('*')
		.eq('id', params.id)
		.eq('client_id', user.id)
		.single();

	if (serviceError || !service) {
		error(404, 'Service not found');
	}

	// Load status history
	const { data: statusHistory } = await supabase
		.from('service_status_history')
		.select('*')
		.eq('service_id', params.id)
		.order('changed_at', { ascending: false });

	// Load courier's reschedule settings
	const { data: courierSettings } = await supabase
		.from('profiles')
		.select('past_due_settings')
		.eq('role', 'courier')
		.single();

	const rescheduleSettings = courierSettings?.past_due_settings || {
		allowClientReschedule: true,
		clientMinNoticeHours: 24,
		clientMaxReschedules: 3
	};

	return {
		service: service as Service,
		statusHistory: (statusHistory || []) as ServiceStatusHistory[],
		rescheduleSettings: {
			allowed: rescheduleSettings.allowClientReschedule ?? true,
			minNoticeHours: rescheduleSettings.clientMinNoticeHours ?? 24,
			maxReschedules: rescheduleSettings.clientMaxReschedules ?? 3
		}
	};
};

export const actions: Actions = {
	requestReschedule: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const newDate = formData.get('date') as string;
		const newTimeSlot = formData.get('time_slot') as string;
		const newTime = formData.get('time') as string | null;
		const reason = formData.get('reason') as string;

		if (!newDate || !newTimeSlot) {
			return { success: false, error: 'Date and time slot required' };
		}

		// Get service and verify ownership
		const { data: service } = await supabase
			.from('services')
			.select('*, profiles!client_id(id)')
			.eq('id', params.id)
			.eq('client_id', user.id)
			.single();

		if (!service) {
			return { success: false, error: 'Service not found' };
		}

		// Only pending services can be rescheduled
		if (service.status !== 'pending') {
			return { success: false, error: 'Only pending services can be rescheduled' };
		}

		// Get courier's reschedule settings
		const { data: courierProfile } = await supabase
			.from('profiles')
			.select('id, past_due_settings')
			.eq('role', 'courier')
			.single();

		const settings = courierProfile?.past_due_settings || {};
		const allowClientReschedule = settings.allowClientReschedule ?? true;
		const clientMinNoticeHours = settings.clientMinNoticeHours ?? 24;
		const clientMaxReschedules = settings.clientMaxReschedules ?? 3;

		// Check if rescheduling is allowed
		if (!allowClientReschedule) {
			return { success: false, error: 'reschedule_disabled', code: 'DISABLED' };
		}

		// Check max reschedules
		if ((service.reschedule_count || 0) >= clientMaxReschedules) {
			return { success: false, error: 'max_reschedules_reached', code: 'MAX_REACHED' };
		}

		// Check minimum notice (only if service has a scheduled date)
		let needsApproval = false;
		if (service.scheduled_date) {
			const scheduledDateTime = new Date(service.scheduled_date + 'T00:00:00');
			const hoursUntilScheduled = (scheduledDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

			if (hoursUntilScheduled < clientMinNoticeHours) {
				needsApproval = true; // Needs courier approval due to short notice
			}
		}

		if (needsApproval) {
			// Create pending reschedule request
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { error: updateError } = await (supabase as any)
				.from('services')
				.update({
					pending_reschedule_date: newDate,
					pending_reschedule_time_slot: newTimeSlot,
					pending_reschedule_time: newTime || null,
					pending_reschedule_reason: reason || null,
					pending_reschedule_requested_at: new Date().toISOString(),
					pending_reschedule_requested_by: user.id
				})
				.eq('id', params.id);

			if (updateError) {
				return { success: false, error: updateError.message };
			}

			// Create history record
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (supabase as any).from('service_reschedule_history').insert({
				service_id: params.id,
				initiated_by: user.id,
				initiated_by_role: 'client',
				old_date: service.scheduled_date,
				old_time_slot: service.scheduled_time_slot,
				old_time: service.scheduled_time,
				new_date: newDate,
				new_time_slot: newTimeSlot,
				new_time: newTime || null,
				reason: reason || null,
				approval_status: 'pending'
			});

			// Notify courier
			if (courierProfile?.id) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await (supabase as any).from('notifications').insert({
					user_id: courierProfile.id,
					type: 'schedule_change',
					title: 'Pedido de Reagendamento',
					message: `O cliente pediu para reagendar uma entrega.`,
					service_id: params.id
				});
			}

			return { success: true, needsApproval: true };
		} else {
			// Auto-approve: update service directly
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

			// Create history record
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (supabase as any).from('service_reschedule_history').insert({
				service_id: params.id,
				initiated_by: user.id,
				initiated_by_role: 'client',
				old_date: service.scheduled_date,
				old_time_slot: service.scheduled_time_slot,
				old_time: service.scheduled_time,
				new_date: newDate,
				new_time_slot: newTimeSlot,
				new_time: newTime || null,
				reason: reason || null,
				approval_status: 'auto_approved'
			});

			return { success: true, needsApproval: false };
		}
	}
};
```

**Step 2: Commit**

```bash
git add src/routes/client/services/[id]/+page.server.ts
git commit -m "feat(reschedule): Add client reschedule request action"
```

**Verification:** Run `pnpm run check` - should have 0 errors

---

## Task 6: Add Reschedule UI to Client Service Detail

**Files:**
- Modify: `src/routes/client/services/[id]/+page.svelte`

**Step 1: Add imports and state (after existing imports, around line 12)**

```typescript
import * as Dialog from '$lib/components/ui/dialog/index.js';
import { Textarea } from '$lib/components/ui/textarea/index.js';
import { Label } from '$lib/components/ui/label/index.js';
import SchedulePicker from '$lib/components/SchedulePicker.svelte';
import { invalidateAll } from '$app/navigation';
import type { TimeSlot } from '$lib/database.types.js';
import { CalendarClock, AlertCircle } from '@lucide/svelte';
```

**Step 2: Add state for reschedule dialog (after line 53)**

```typescript
// Reschedule dialog state
let showRescheduleDialog = $state(false);
let rescheduleDate = $state<string | null>(null);
let rescheduleTimeSlot = $state<TimeSlot | null>(null);
let rescheduleTime = $state<string | null>(null);
let rescheduleReason = $state('');
let rescheduleLoading = $state(false);
let rescheduleError = $state('');

// Reschedule availability checks
const canReschedule = $derived(() => {
	if (service.status !== 'pending') return { allowed: false, reason: 'not_pending' };
	if (!data.rescheduleSettings.allowed) return { allowed: false, reason: 'disabled' };
	if ((service.reschedule_count || 0) >= data.rescheduleSettings.maxReschedules) {
		return { allowed: false, reason: 'max_reached' };
	}
	if (service.pending_reschedule_date) return { allowed: false, reason: 'pending_request' };
	return { allowed: true, reason: null };
});

function openRescheduleDialog() {
	rescheduleDate = service.scheduled_date;
	rescheduleTimeSlot = service.scheduled_time_slot as TimeSlot | null;
	rescheduleTime = service.scheduled_time;
	rescheduleReason = '';
	rescheduleError = '';
	showRescheduleDialog = true;
}

async function handleReschedule() {
	if (!rescheduleDate || !rescheduleTimeSlot) return;

	rescheduleLoading = true;
	rescheduleError = '';

	const formData = new FormData();
	formData.set('date', rescheduleDate);
	formData.set('time_slot', rescheduleTimeSlot);
	if (rescheduleTime) formData.set('time', rescheduleTime);
	formData.set('reason', rescheduleReason);

	try {
		const response = await fetch('?/requestReschedule', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();
		if (result.data?.success) {
			await invalidateAll();
			showRescheduleDialog = false;
		} else {
			rescheduleError = result.data?.error || 'Failed to request reschedule';
		}
	} catch {
		rescheduleError = 'An unexpected error occurred';
	}

	rescheduleLoading = false;
}
```

**Step 3: Add Reschedule Button and Pending Banner in the template (after Status Badge Card, around line 82)**

```svelte
<!-- Reschedule Section -->
{#if service.status === 'pending'}
	<!-- Pending Reschedule Banner -->
	{#if service.pending_reschedule_date}
		<Card.Root class="border-orange-200 bg-orange-50">
			<Card.Content class="flex items-start gap-3 p-4">
				<AlertCircle class="size-5 text-orange-600 mt-0.5" />
				<div>
					<p class="font-medium text-orange-800">{m.client_reschedule_pending()}</p>
					<p class="text-sm text-orange-700 mt-1">{m.client_reschedule_pending_desc()}</p>
					<p class="text-sm text-orange-600 mt-2">
						{formatDate(service.pending_reschedule_date)}
						{#if service.pending_reschedule_time_slot}
							- {formatTimeSlot(service.pending_reschedule_time_slot)}
						{/if}
					</p>
				</div>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- Reschedule Button -->
		{@const check = canReschedule()}
		{#if check.allowed}
			<Button variant="outline" class="w-full" onclick={openRescheduleDialog}>
				<CalendarClock class="size-4 mr-2" />
				{m.client_request_reschedule()}
			</Button>
		{:else if check.reason === 'max_reached'}
			<div class="text-sm text-muted-foreground text-center p-2">
				{m.client_reschedule_max_reached()}
			</div>
		{:else if check.reason === 'disabled'}
			<div class="text-sm text-muted-foreground text-center p-2">
				{m.client_reschedule_disabled()}
			</div>
		{/if}
	{/if}
{/if}
```

**Step 4: Add Reschedule Dialog at the end of the file (before closing `</div>`)**

```svelte
<!-- Reschedule Dialog -->
<Dialog.Root bind:open={showRescheduleDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<CalendarClock class="size-5" />
				{m.client_request_reschedule()}
			</Dialog.Title>
			<Dialog.Description>{m.client_request_reschedule_desc()}</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if rescheduleError}
				<div role="alert" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{rescheduleError}
				</div>
			{/if}

			<SchedulePicker
				selectedDate={rescheduleDate}
				selectedTimeSlot={rescheduleTimeSlot}
				selectedTime={rescheduleTime}
				onDateChange={(date) => (rescheduleDate = date)}
				onTimeSlotChange={(slot) => (rescheduleTimeSlot = slot)}
				onTimeChange={(time) => (rescheduleTime = time)}
			/>

			<div class="space-y-2">
				<Label for="reschedule-reason">{m.client_reschedule_reason()}</Label>
				<Textarea
					id="reschedule-reason"
					bind:value={rescheduleReason}
					placeholder={m.client_reschedule_reason_placeholder()}
					rows={2}
				/>
			</div>

			<p class="text-xs text-muted-foreground">
				{m.client_reschedule_too_late({ hours: data.rescheduleSettings.minNoticeHours })}
			</p>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showRescheduleDialog = false)} disabled={rescheduleLoading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleReschedule} disabled={!rescheduleDate || !rescheduleTimeSlot || rescheduleLoading}>
				{rescheduleLoading ? m.saving() : m.client_request_reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
```

**Step 5: Commit**

```bash
git add src/routes/client/services/[id]/+page.svelte
git commit -m "feat(reschedule): Add reschedule request UI to client service detail"
```

**Verification:** Run `pnpm run check` - should have 0 errors

---

## Task 7: Add Pending Reschedules to Courier Requests Page

**Files:**
- Modify: `src/routes/courier/requests/+page.server.ts`
- Modify: `src/routes/courier/requests/+page.svelte`

**Step 1: Update server load to fetch pending reschedules (after line 54 in +page.server.ts)**

```typescript
// Load services with pending reschedule requests
const { data: pendingReschedules } = await supabase
	.from('services')
	.select('*, profiles!client_id(id, name, phone)')
	.not('pending_reschedule_date', 'is', null)
	.is('deleted_at', null)
	.order('pending_reschedule_requested_at', { ascending: true });

return {
	pendingRequests: (pendingRequests || []) as (Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> })[],
	pendingReschedules: (pendingReschedules || []) as (Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> })[]
};
```

**Step 2: Add approve/deny actions (after suggest action in +page.server.ts)**

```typescript
,
approveReschedule: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return { success: false, error: 'Not authenticated' };
	}

	const formData = await request.formData();
	const serviceId = formData.get('service_id') as string;

	if (!serviceId) {
		return { success: false, error: 'Service ID required' };
	}

	// Get the service with pending reschedule
	const { data: service } = await supabase
		.from('services')
		.select('*, profiles!client_id(id)')
		.eq('id', serviceId)
		.single();

	if (!service || !service.pending_reschedule_date) {
		return { success: false, error: 'No pending reschedule request' };
	}

	// Apply the reschedule
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error: updateError } = await (supabase as any)
		.from('services')
		.update({
			scheduled_date: service.pending_reschedule_date,
			scheduled_time_slot: service.pending_reschedule_time_slot,
			scheduled_time: service.pending_reschedule_time,
			reschedule_count: (service.reschedule_count || 0) + 1,
			last_rescheduled_at: new Date().toISOString(),
			last_rescheduled_by: service.pending_reschedule_requested_by,
			// Clear pending fields
			pending_reschedule_date: null,
			pending_reschedule_time_slot: null,
			pending_reschedule_time: null,
			pending_reschedule_reason: null,
			pending_reschedule_requested_at: null,
			pending_reschedule_requested_by: null
		})
		.eq('id', serviceId);

	if (updateError) {
		return { success: false, error: updateError.message };
	}

	// Update history record
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await (supabase as any)
		.from('service_reschedule_history')
		.update({
			approval_status: 'approved',
			approved_by: user.id,
			approved_at: new Date().toISOString()
		})
		.eq('service_id', serviceId)
		.eq('approval_status', 'pending');

	// Notify client
	if (service.client_id) {
		await notifyClient(
			session,
			service.client_id,
			serviceId,
			'Reagendamento Aprovado',
			'O seu pedido de reagendamento foi aprovado.'
		);
	}

	return { success: true };
},

denyReschedule: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return { success: false, error: 'Not authenticated' };
	}

	const formData = await request.formData();
	const serviceId = formData.get('service_id') as string;
	const denialReason = formData.get('denial_reason') as string;

	if (!serviceId) {
		return { success: false, error: 'Service ID required' };
	}

	// Get the service with pending reschedule
	const { data: service } = await supabase
		.from('services')
		.select('client_id')
		.eq('id', serviceId)
		.single();

	// Clear pending reschedule fields
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { error: updateError } = await (supabase as any)
		.from('services')
		.update({
			pending_reschedule_date: null,
			pending_reschedule_time_slot: null,
			pending_reschedule_time: null,
			pending_reschedule_reason: null,
			pending_reschedule_requested_at: null,
			pending_reschedule_requested_by: null
		})
		.eq('id', serviceId);

	if (updateError) {
		return { success: false, error: updateError.message };
	}

	// Update history record
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await (supabase as any)
		.from('service_reschedule_history')
		.update({
			approval_status: 'denied',
			approved_by: user.id,
			approved_at: new Date().toISOString(),
			denial_reason: denialReason || null
		})
		.eq('service_id', serviceId)
		.eq('approval_status', 'pending');

	// Notify client
	if (service?.client_id) {
		const reasonText = denialReason ? ` Motivo: ${denialReason}` : '';
		await notifyClient(
			session,
			service.client_id,
			serviceId,
			'Reagendamento Recusado',
			`O seu pedido de reagendamento foi recusado.${reasonText}`
		);
	}

	return { success: true };
}
```

**Step 3: Add pending reschedules section to the page template (in +page.svelte, after existing pendingRequests section)**

```svelte
<!-- Pending Reschedules Section -->
{#if data.pendingReschedules.length > 0}
	<Separator class="my-6" />

	<div class="space-y-4">
		<div>
			<h2 class="text-xl font-semibold">{m.courier_pending_reschedules()}</h2>
			<p class="text-muted-foreground text-sm">{m.courier_pending_reschedules_desc()}</p>
		</div>

		<div class="grid gap-4">
			{#each data.pendingReschedules as service}
				<Card.Root class="border-orange-200">
					<Card.Content class="pt-6">
						<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
							<div class="space-y-3 flex-1">
								<!-- Client info -->
								<div class="flex items-center gap-2">
									<a
										href={localizeHref(`/courier/clients/${service.profiles.id}`)}
										class="font-medium hover:underline"
									>
										{service.profiles.name}
									</a>
								</div>

								<!-- Current schedule -->
								<div class="text-sm">
									<span class="text-muted-foreground">Atual:</span>
									{formatRequestDate(service.scheduled_date)}
									{#if service.scheduled_time_slot}
										- {formatTimeSlot(service.scheduled_time_slot)}
									{/if}
								</div>

								<!-- Requested schedule -->
								<div class="text-sm font-medium text-orange-600">
									<span>Novo:</span>
									{formatRequestDate(service.pending_reschedule_date)}
									{#if service.pending_reschedule_time_slot}
										- {formatTimeSlot(service.pending_reschedule_time_slot)}
									{/if}
								</div>

								<!-- Reason -->
								{#if service.pending_reschedule_reason}
									<p class="text-sm text-muted-foreground italic">
										"{service.pending_reschedule_reason}"
									</p>
								{/if}
							</div>

							<!-- Actions -->
							<div class="flex flex-wrap gap-2">
								<Button size="sm" onclick={() => handleApproveReschedule(service.id)}>
									{m.courier_approve_reschedule()}
								</Button>
								<Button size="sm" variant="destructive" onclick={() => openDenyRescheduleDialog(service)}>
									{m.courier_deny_reschedule()}
								</Button>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</div>
{/if}
```

**Step 4: Add state and handlers for reschedule approval/denial (in script section)**

```typescript
// Reschedule denial state
let showDenyRescheduleDialog = $state(false);
let denyingService = $state<ServiceWithClient | null>(null);
let denialReason = $state('');

function openDenyRescheduleDialog(service: ServiceWithClient) {
	denyingService = service;
	denialReason = '';
	showDenyRescheduleDialog = true;
}

async function handleApproveReschedule(serviceId: string) {
	loading = true;
	actionError = '';

	const formData = new FormData();
	formData.set('service_id', serviceId);

	try {
		const response = await fetch('?/approveReschedule', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			const result = await response.json();
			if (result.type === 'success' || result.data?.success) {
				await invalidateAll();
			} else {
				actionError = result.data?.error || 'Failed to approve reschedule';
			}
		}
	} catch {
		actionError = 'An unexpected error occurred';
	}
	loading = false;
}

async function handleDenyReschedule() {
	if (!denyingService) return;
	loading = true;
	actionError = '';

	const formData = new FormData();
	formData.set('service_id', denyingService.id);
	formData.set('denial_reason', denialReason);

	try {
		const response = await fetch('?/denyReschedule', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			const result = await response.json();
			if (result.type === 'success' || result.data?.success) {
				await invalidateAll();
				showDenyRescheduleDialog = false;
			} else {
				actionError = result.data?.error || 'Failed to deny reschedule';
			}
		}
	} catch {
		actionError = 'An unexpected error occurred';
	}
	loading = false;
}
```

**Step 5: Add deny reschedule dialog (before closing `</div>`)**

```svelte
<!-- Deny Reschedule Dialog -->
<Dialog.Root bind:open={showDenyRescheduleDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.courier_deny_reschedule()}</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="denial-reason">{m.courier_deny_reason()}</Label>
				<Input
					id="denial-reason"
					type="text"
					placeholder={m.courier_deny_reason_placeholder()}
					bind:value={denialReason}
					disabled={loading}
				/>
			</div>
		</div>

		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showDenyRescheduleDialog = false)} disabled={loading}>
				{m.action_cancel()}
			</Button>
			<Button variant="destructive" onclick={handleDenyReschedule} disabled={loading}>
				{loading ? m.saving() : m.courier_deny_reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
```

**Step 6: Commit**

```bash
git add src/routes/courier/requests/+page.server.ts src/routes/courier/requests/+page.svelte
git commit -m "feat(reschedule): Add pending reschedules section to courier requests"
```

**Verification:** Run `pnpm run check` - should have 0 errors

---

## Task 8: Update Courier Reschedule to Track History

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.server.ts`

**Step 1: Update reschedule action to create history record (after line 179)**

Add history insert after successful service update:

```typescript
// Create history record for courier-initiated reschedule
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await (supabase as any).from('service_reschedule_history').insert({
	service_id: params.id,
	initiated_by: user.id,
	initiated_by_role: 'courier',
	old_date: service.scheduled_date,
	old_time_slot: service.scheduled_time_slot,
	old_time: service.scheduled_time,
	new_date: newDate,
	new_time_slot: newTimeSlot,
	new_time: newTime || null,
	reason: reason || null,
	approval_status: 'auto_approved' // Courier changes are always auto-approved
});
```

**Step 2: Commit**

```bash
git add src/routes/courier/services/[id]/+page.server.ts
git commit -m "feat(reschedule): Track courier reschedules in history"
```

---

## Task 9: Add Nav Badge for Pending Reschedules

**Files:**
- Modify: `src/routes/courier/+layout.server.ts`

**Step 1: Add count of pending reschedules to nav counts (update the Promise.all)**

Change the parallel queries to include pending reschedules:

```typescript
const [profileResult, pendingRequestsResult, pendingReschedulesResult] = await Promise.all([
	supabase.from('profiles').select('*').eq('id', user.id).single(),
	supabase
		.from('services')
		.select('*', { count: 'exact', head: true })
		.eq('request_status', 'pending')
		.is('deleted_at', null),
	supabase
		.from('services')
		.select('*', { count: 'exact', head: true })
		.not('pending_reschedule_date', 'is', null)
		.is('deleted_at', null)
]);
```

**Step 2: Update return statement**

```typescript
return {
	profile: {
		id: profile.id,
		role: profile.role,
		name: profile.name,
		past_due_settings: profile.past_due_settings
	},
	navCounts: {
		pendingRequests: (pendingRequestsResult.count ?? 0) + (pendingReschedulesResult.count ?? 0)
	}
};
```

**Step 3: Commit**

```bash
git add src/routes/courier/+layout.server.ts
git commit -m "feat(reschedule): Include pending reschedules in nav badge count"
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

Check for any new RLS issues.

**Step 3: Test the full flow**

1. As client: Open a pending service, request reschedule
2. Verify auto-approval if within policy
3. Verify pending request if outside policy
4. As courier: View requests page, see pending reschedule
5. Approve or deny the reschedule
6. Verify notifications sent to client

**Step 4: Final commit**

```bash
git add -A
git commit -m "docs: Mark Phase 4 reschedule workflow complete"
```

---

# Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create reschedule history table | migration |
| 2 | Add pending reschedule fields | migration |
| 3 | Update TypeScript types | database.types.ts |
| 4 | Add translations | messages/*.json |
| 5 | Client reschedule server action | client/services/[id]/+page.server.ts |
| 6 | Client reschedule UI | client/services/[id]/+page.svelte |
| 7 | Courier pending reschedules | courier/requests/+page.* |
| 8 | Courier reschedule history | courier/services/[id]/+page.server.ts |
| 9 | Nav badge update | courier/+layout.server.ts |
| 10 | Final verification | - |

**Parallel opportunities:**
- Tasks 1-2 (migrations): Sequential
- Tasks 3-4 (types + translations): Parallel
- Tasks 5-6 (client): Sequential (6 depends on 5)
- Tasks 7-9 (courier): Can run in parallel with 5-6
- Task 10: Sequential (verification)
