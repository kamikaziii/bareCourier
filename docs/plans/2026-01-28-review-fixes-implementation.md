# Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 12 findings from the multi-agent code review of the UX audit implementation.

**Architecture:** SvelteKit 2 + Svelte 5 runes + Supabase + Paraglide i18n. Server actions for mutations, client-side data loading via `data.supabase`, RLS trigger for field-level update restrictions.

**Tech Stack:** SvelteKit, Svelte 5, Tailwind CSS v4, shadcn-svelte, Supabase, Paraglide

---

## Phase 1: Critical Fixes (P1)

### Task 1: Remove Price Recalculation from Client Edit

**Files:**
- Modify: `src/routes/client/services/[id]/edit/+page.server.ts`

**Context:** The RLS trigger (migration 034) always blocks clients from modifying `calculated_price` and `price_breakdown`. The edit server action recalculates these, causing the UPDATE to fail when the price changes. Fix: remove pricing logic entirely — courier owns pricing.

**Step 1: Remove pricing imports and logic**

Remove lines 3-8 (pricing/distance imports), lines 80-124 (courier settings fetch, distance calculation, pricing calculation), and lines 141-142 (`calculated_price`, `price_breakdown` from the update object).

The update object should only contain:
```typescript
const { error: updateError } = await (supabase as any).from('services').update({
	pickup_location,
	delivery_location,
	notes,
	requested_date,
	requested_time_slot,
	requested_time,
	pickup_lat,
	pickup_lng,
	delivery_lat,
	delivery_lng,
	distance_km,
	urgency_fee_id: urgency_fee_id || null
}).eq('id', params.id);
```

Keep the distance calculation (lines 83-101) since `distance_km` is an allowed field for clients on pending services. Only remove the pricing parts.

**Step 2: Clean up unused variables**

Remove `calculated_price`, `price_breakdown`, `pricingConfig`, `courierSettings` (only used for pricing — but check: `courierSettings` is also used for distance calculation). Keep `courierSettings` if needed for `warehouseCoords`, `pricingMode`, `roundDistance` in `calculateServiceDistance`. Actually, read the distance call — it needs `courierSettings.warehouseCoords`, `courierSettings.pricingMode`, `courierSettings.roundDistance`. So keep `getCourierPricingSettings` import and call, but remove `calculateServicePrice`, `getClientPricing` imports.

**Step 3: Verify**

Run: `pnpm run check`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/routes/client/services/[id]/edit/+page.server.ts
git commit -m "fix: remove price recalculation from client edit server action

The RLS trigger blocks clients from modifying calculated_price and
price_breakdown. Courier owns pricing; they recalculate when reviewing."
```

---

### Task 2: Route Batch Accept/Decline Through Server Actions

**Files:**
- Modify: `src/routes/client/+page.server.ts`
- Modify: `src/routes/client/+page.svelte`

**Context:** Batch accept/decline calls `data.supabase` directly from the client, bypassing server-side ownership verification. The trigger blocks `scheduled_date`/`scheduled_time_slot` for clients. The existing individual `acceptSuggestion` and `declineSuggestion` actions in `+page.server.ts` show the correct pattern. Also remove unused `batchDeclineReason`.

**Step 1: Add batch server actions to `+page.server.ts`**

Add two new actions after the existing `cancelRequest` action. Follow the same pattern as `acceptSuggestion`/`declineSuggestion` but accept a JSON array of IDs:

```typescript
batchAcceptSuggestions: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return { success: false, error: 'Not authenticated' };
	}

	const formData = await request.formData();
	const serviceIdsJson = formData.get('service_ids') as string;
	if (!serviceIdsJson) {
		return { success: false, error: 'Service IDs required' };
	}

	let serviceIds: string[];
	try {
		serviceIds = JSON.parse(serviceIdsJson);
	} catch {
		return { success: false, error: 'Invalid service IDs' };
	}

	if (serviceIds.length === 0) {
		return { success: false, error: 'No services selected' };
	}

	// Get all services and verify ownership
	const { data: servicesData } = await supabase
		.from('services')
		.select('id, client_id, suggested_date, suggested_time_slot, suggested_time')
		.in('id', serviceIds)
		.eq('client_id', user.id);

	if (!servicesData || servicesData.length !== serviceIds.length) {
		return { success: false, error: 'Some services not found or unauthorized' };
	}

	// Accept each suggestion
	let failCount = 0;
	for (const svc of servicesData) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('services')
			.update({
				request_status: 'accepted',
				scheduled_date: svc.suggested_date,
				scheduled_time_slot: svc.suggested_time_slot,
				scheduled_time: svc.suggested_time,
				suggested_date: null,
				suggested_time_slot: null,
				suggested_time: null
			})
			.eq('id', svc.id);
		if (error) failCount++;
	}

	// Notify courier about batch acceptance
	const courierId = await getCourierId(supabase);
	if (courierId) {
		await notifyCourier(
			supabase,
			session,
			servicesData[0].id,
			'Sugestões Aceites',
			`O cliente aceitou ${servicesData.length} sugestão(ões) de data.`
		);
	}

	if (failCount > 0) {
		return { success: true, error: `${failCount} of ${serviceIds.length} failed` };
	}
	return { success: true };
},

batchDeclineSuggestions: async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return { success: false, error: 'Not authenticated' };
	}

	const formData = await request.formData();
	const serviceIdsJson = formData.get('service_ids') as string;
	if (!serviceIdsJson) {
		return { success: false, error: 'Service IDs required' };
	}

	let serviceIds: string[];
	try {
		serviceIds = JSON.parse(serviceIdsJson);
	} catch {
		return { success: false, error: 'Invalid service IDs' };
	}

	if (serviceIds.length === 0) {
		return { success: false, error: 'No services selected' };
	}

	// Verify ownership
	const { data: servicesData } = await supabase
		.from('services')
		.select('id, client_id')
		.in('id', serviceIds)
		.eq('client_id', user.id);

	if (!servicesData || servicesData.length !== serviceIds.length) {
		return { success: false, error: 'Some services not found or unauthorized' };
	}

	// Decline all
	let failCount = 0;
	for (const svc of servicesData) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('services')
			.update({
				request_status: 'pending',
				suggested_date: null,
				suggested_time_slot: null,
				suggested_time: null
			})
			.eq('id', svc.id);
		if (error) failCount++;
	}

	await notifyCourier(
		supabase,
		session,
		servicesData[0].id,
		'Sugestões Recusadas',
		`O cliente recusou ${servicesData.length} sugestão(ões). Os pedidos estão novamente pendentes.`
	);

	if (failCount > 0) {
		return { success: true, error: `${failCount} of ${serviceIds.length} failed` };
	}
	return { success: true };
},
```

**Step 2: Update client-side handlers in `+page.svelte`**

Replace `handleBatchAcceptSuggestions` and `handleBatchDeclineSuggestions` to call server actions via fetch instead of direct Supabase calls. Follow the same pattern as the existing `handleAcceptSuggestion` etc. that use `fetch('?/actionName', { method: 'POST', body: formData })`.

```typescript
async function handleBatchAcceptSuggestions() {
	if (!suggestionBatch.hasSelection) return;
	batchActionLoading = true;

	const formData = new FormData();
	formData.set('service_ids', JSON.stringify(Array.from(suggestionBatch.selectedIds)));

	try {
		const response = await fetch('?/batchAcceptSuggestions', { method: 'POST', body: formData });
		const result = await response.json();
		if (result.data?.success) {
			suggestionBatch.reset();
			await loadServices();
		} else {
			actionError = result.data?.error || 'Failed to accept suggestions';
		}
	} catch {
		actionError = 'An error occurred';
	}
	batchActionLoading = false;
}

async function handleBatchDeclineSuggestions() {
	if (!suggestionBatch.hasSelection) return;
	batchActionLoading = true;

	const formData = new FormData();
	formData.set('service_ids', JSON.stringify(Array.from(suggestionBatch.selectedIds)));

	try {
		const response = await fetch('?/batchDeclineSuggestions', { method: 'POST', body: formData });
		const result = await response.json();
		if (result.data?.success) {
			suggestionBatch.reset();
			showBatchDeclineDialog = false;
			await loadServices();
		} else {
			actionError = result.data?.error || 'Failed to decline suggestions';
		}
	} catch {
		actionError = 'An error occurred';
	}
	batchActionLoading = false;
}
```

**Step 3: Remove `batchDeclineReason`**

- Remove `let batchDeclineReason = $state('');` declaration
- Remove the `<Label>` + `<Textarea>` for reason in the batch decline dialog template
- Remove `batchDeclineReason = '';` from any reset code

**Step 4: Fix import extension**

Change line 21 from:
```typescript
import { useBatchSelection } from '$lib/composables/use-batch-selection.svelte';
```
to:
```typescript
import { useBatchSelection } from '$lib/composables/use-batch-selection.svelte.js';
```

**Step 5: Verify**

Run: `pnpm run check`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/routes/client/+page.server.ts src/routes/client/+page.svelte
git commit -m "fix: route batch accept/decline through server actions

Batch operations now use server actions with ownership verification
instead of direct client-side Supabase calls. Also removes unused
batchDeclineReason and fixes missing .js import extension."
```

---

## Phase 2: Shared Abstractions

### Task 3: Create usePagination Composable

**Files:**
- Create: `src/lib/composables/use-pagination.svelte.ts`

**Context:** Follow the same pattern as `use-batch-selection.svelte.ts`. Accept a getter function for the items array and a page size. Return reactive state via getters.

**Step 1: Create the composable**

```typescript
/**
 * Shared pagination composable.
 * Accepts a getter for the items array and an optional page size.
 */
export function usePagination<T>(items: () => T[], pageSize = 20) {
	let currentPage = $state(1);

	const totalPages = $derived(Math.max(1, Math.ceil(items().length / pageSize)));
	const paginatedItems = $derived(
		items().slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
	const totalItems = $derived(items().length);

	function reset() {
		currentPage = 1;
	}

	function prev() {
		if (currentPage > 1) currentPage--;
	}

	function next() {
		if (currentPage < totalPages) currentPage++;
	}

	return {
		get currentPage() { return currentPage; },
		set currentPage(v: number) { currentPage = v; },
		get totalPages() { return totalPages; },
		get paginatedItems() { return paginatedItems; },
		get totalItems() { return totalItems; },
		reset,
		prev,
		next
	};
}
```

**Step 2: Verify**

Run: `pnpm run check`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/composables/use-pagination.svelte.ts
git commit -m "feat: add shared usePagination composable"
```

---

### Task 4: Create PaginationControls Component

**Files:**
- Create: `src/lib/components/PaginationControls.svelte`

**Context:** Simple prev/next buttons with page indicator. Uses i18n keys (will be hardcoded first, i18n added in Task 7).

**Step 1: Create the component**

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as m from '$lib/paraglide/messages.js';

	let {
		currentPage,
		totalPages,
		onPrev,
		onNext
	}: {
		currentPage: number;
		totalPages: number;
		onPrev: () => void;
		onNext: () => void;
	} = $props();
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-center gap-2 py-4">
		<Button variant="outline" size="sm" disabled={currentPage === 1} onclick={onPrev}>
			{m.pagination_previous()}
		</Button>
		<span class="text-muted-foreground text-sm">
			{m.pagination_page_of({ current: currentPage, total: totalPages })}
		</span>
		<Button variant="outline" size="sm" disabled={currentPage === totalPages} onclick={onNext}>
			{m.pagination_next()}
		</Button>
	</div>
{/if}
```

**Step 2: Commit**

```bash
git add src/lib/components/PaginationControls.svelte
git commit -m "feat: add shared PaginationControls component"
```

---

### Task 5: Apply Pagination Composable + Component to All 4 Pages

**Files:**
- Modify: `src/routes/client/+page.svelte`
- Modify: `src/routes/client/billing/+page.svelte`
- Modify: `src/routes/courier/services/+page.svelte`
- Modify: `src/routes/courier/billing/+page.svelte`

**Context:** Each page currently has ~15 lines of duplicated pagination state + UI. Replace with the composable + component. The composable needs a getter function, so pass `() => filteredItems` or equivalent.

**Step 1: For each page, replace pagination code**

For each of the 4 files:

1. Add imports:
```typescript
import { usePagination } from '$lib/composables/use-pagination.svelte.js';
import PaginationControls from '$lib/components/PaginationControls.svelte';
```

2. Replace the pagination state block:
```typescript
// REMOVE:
const PAGE_SIZE = 20;
let currentPage = $state(1);
const totalPages = $derived(Math.ceil(someList.length / PAGE_SIZE));
const paginatedItems = $derived(someList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));
$effect(() => { /* deps */ currentPage = 1; });

// ADD:
const pagination = usePagination(() => someList);
// For the $effect reset, use:
$effect(() => { /* deps */ pagination.reset(); });
```

3. Replace template usage:
- `paginatedItems` → `pagination.paginatedItems`
- `totalPages` → `pagination.totalPages`
- `currentPage` → `pagination.currentPage`
- Replace the entire prev/next button block with:
```svelte
<PaginationControls
	currentPage={pagination.currentPage}
	totalPages={pagination.totalPages}
	onPrev={pagination.prev}
	onNext={pagination.next}
/>
```

**Step 2: Delete unused shadcn pagination files**

```bash
rm -rf src/lib/components/ui/pagination/
```

**Step 3: Verify**

Run: `pnpm run check`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/routes/client/+page.svelte src/routes/client/billing/+page.svelte \
  src/routes/courier/services/+page.svelte src/routes/courier/billing/+page.svelte
git rm -r src/lib/components/ui/pagination/
git commit -m "refactor: replace duplicated pagination with shared composable + component

Applies usePagination composable and PaginationControls component to all
4 paginated pages. Deletes unused shadcn pagination files (10 files)."
```

---

## Phase 3: i18n

### Task 6: Add i18n Keys to Message Files

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Context:** Add keys for all hardcoded strings. The existing pattern uses flat keys like `"nav_dashboard": "Dashboard"`. Group new keys by feature area.

**Step 1: Add keys to `messages/en.json`**

Add these keys (find appropriate position in the file, group with related keys):

```json
"client_needs_attention": "Needs your attention",
"client_courier_suggested_date": "Courier suggested a new date",
"client_request_declined": "Request was declined",
"client_respond": "Respond",
"client_resubmit": "Re-submit with changes",
"client_accept_all": "Accept all",
"client_decline_all": "Decline all",
"client_selected_count": "{count} selected",
"client_decline_selected_title": "Decline Selected Suggestions",
"client_decline_selected_desc": "This will reset {count} suggestion(s) back to pending.",

"sort_newest": "Newest first",
"sort_oldest": "Oldest first",
"sort_pending_first": "Pending first",
"sort_delivered_first": "Delivered first",

"edit_service_title": "Edit Service Request",
"edit_service_description": "Update your pending service request",
"edit_service_save": "Save Changes",

"empty_courier_services": "Create your first service to get started.",
"empty_client_services": "Create your first request to get started.",

"pagination_previous": "Previous",
"pagination_next": "Next",
"pagination_page_of": "Page {current} of {total}"
```

**Step 2: Add Portuguese translations to `messages/pt-PT.json`**

```json
"client_needs_attention": "Precisa da sua atenção",
"client_courier_suggested_date": "O estafeta sugeriu uma nova data",
"client_request_declined": "O pedido foi recusado",
"client_respond": "Responder",
"client_resubmit": "Reenviar com alterações",
"client_accept_all": "Aceitar todos",
"client_decline_all": "Recusar todos",
"client_selected_count": "{count} selecionado(s)",
"client_decline_selected_title": "Recusar Sugestões Selecionadas",
"client_decline_selected_desc": "Isto irá repor {count} sugestão(ões) como pendente(s).",

"sort_newest": "Mais recentes",
"sort_oldest": "Mais antigos",
"sort_pending_first": "Pendentes primeiro",
"sort_delivered_first": "Entregues primeiro",

"edit_service_title": "Editar Pedido de Serviço",
"edit_service_description": "Atualize o seu pedido de serviço pendente",
"edit_service_save": "Guardar Alterações",

"empty_courier_services": "Crie o seu primeiro serviço para começar.",
"empty_client_services": "Crie o seu primeiro pedido para começar.",

"pagination_previous": "Anterior",
"pagination_next": "Seguinte",
"pagination_page_of": "Página {current} de {total}"
```

**Step 3: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat: add i18n keys for review fix hardcoded strings"
```

---

### Task 7: Replace Hardcoded Strings with i18n Calls

**Files:**
- Modify: `src/routes/client/+page.svelte`
- Modify: `src/routes/client/services/[id]/edit/+page.svelte`
- Modify: `src/routes/courier/services/+page.svelte`

**Context:** Replace all hardcoded English strings with `m.xxx()` calls. The `PaginationControls` component already uses i18n from Task 4. Search for literal English text in each file.

**Step 1: Client dashboard (`src/routes/client/+page.svelte`)**

Replace these strings:
- `"Needs your attention"` → `{m.client_needs_attention()}`
- `"Courier suggested a new date"` → `{m.client_courier_suggested_date()}`
- `"Request was declined"` → `{m.client_request_declined()}`
- `"Respond"` → `{m.client_respond()}`
- `"Re-submit with changes"` → `{m.client_resubmit()}`
- `"Accept all"` → `{m.client_accept_all()}`
- `"Decline all"` → `{m.client_decline_all()}`
- `"X selected"` → `{m.client_selected_count({ count: suggestionBatch.selectedCount })}`
- `"Decline Selected Suggestions"` → `{m.client_decline_selected_title()}`
- The description text → `{m.client_decline_selected_desc({ count: suggestionBatch.selectedCount })}`
- `"Newest first"` → `{m.sort_newest()}`
- `"Oldest first"` → `{m.sort_oldest()}`
- `"Pending first"` → `{m.sort_pending_first()}`
- `"Delivered first"` → `{m.sort_delivered_first()}`
- Empty state description → `{m.empty_client_services()}`

**Step 2: Client edit (`src/routes/client/services/[id]/edit/+page.svelte`)**

Replace:
- `"Edit Service Request"` → `{m.edit_service_title()}`
- `"Update your pending service request"` → `{m.edit_service_description()}`
- `"Save Changes"` → `{m.edit_service_save()}`

**Step 3: Courier services (`src/routes/courier/services/+page.svelte`)**

Replace:
- Empty state description `"Create your first service to get started."` → `{m.empty_courier_services()}`

**Step 4: Verify**

Run: `pnpm run check`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/routes/client/+page.svelte src/routes/client/services/[id]/edit/+page.svelte \
  src/routes/courier/services/+page.svelte
git commit -m "fix: replace hardcoded English strings with i18n calls"
```

---

## Phase 4: Consistency Fixes

### Task 8: Replace Calendar Inline SVGs with Lucide Icons

**Files:**
- Modify: `src/routes/client/calendar/+page.svelte`

**Context:** Calendar uses hand-rolled `<svg>` elements for chevron navigation. Replace with `ChevronLeft`, `ChevronRight` from `@lucide/svelte`.

**Step 1: Add Lucide imports**

Add to the existing imports:
```typescript
import { ChevronLeft, ChevronRight } from '@lucide/svelte';
```

**Step 2: Replace inline SVGs**

Find all `<svg>` elements that render chevron arrows and replace with:
- Left chevron: `<ChevronLeft class="size-5" />`
- Right chevron: `<ChevronRight class="size-5" />`

**Step 3: Verify**

Run: `pnpm run check`

**Step 4: Commit**

```bash
git add src/routes/client/calendar/+page.svelte
git commit -m "refactor: replace inline SVGs with Lucide icons in calendar"
```

---

### Task 9: Replace sessionStorage with URL Search Params

**Files:**
- Modify: `src/routes/courier/services/new/+page.server.ts`
- Modify: `src/routes/courier/services/new/+page.svelte`
- Modify: `src/routes/courier/services/+page.svelte`

**Context:** After creating a service without pricing, the warning is passed via sessionStorage. Replace with URL params.

**Step 1: Update server action redirect**

In `src/routes/courier/services/new/+page.server.ts`, change the success return from `{ success: true, warning }` to a redirect that includes the warning:

Find the success return path. If `warning` is set, the redirect should go to `/courier/services?warning=no_pricing`. If no warning, redirect to `/courier/services`.

Actually, looking at the current code: it returns `{ success: true, warning }` and the client-side `handleFormSubmit` handles the redirect via `goto()`. So update the client-side code instead.

**Step 2: Update client-side form handler in `+page.svelte`**

In `src/routes/courier/services/new/+page.svelte`, find the `handleFormSubmit` callback. Change:
```typescript
if (result.data.warning) {
	sessionStorage.setItem('serviceFormWarning', result.data.warning);
}
goto(localizeHref('/courier/services'));
```
to:
```typescript
const params = result.data.warning ? `?warning=${result.data.warning}` : '';
goto(localizeHref('/courier/services') + params);
```

**Step 3: Update list page to read from URL**

In `src/routes/courier/services/+page.svelte`, replace sessionStorage reading:

Remove:
```typescript
const warning = sessionStorage.getItem('serviceFormWarning');
if (warning) {
	formWarning = warning;
	sessionStorage.removeItem('serviceFormWarning');
}
```

Add (at script top):
```typescript
import { page } from '$app/stores';
import { replaceState } from '$app/navigation';
```

Add effect:
```typescript
$effect(() => {
	const warning = $page.url.searchParams.get('warning');
	if (warning) {
		formWarning = warning;
		// Clear the URL param without navigation
		const url = new URL($page.url);
		url.searchParams.delete('warning');
		replaceState(url, {});
	}
});
```

**Step 4: Verify**

Run: `pnpm run check`

**Step 5: Commit**

```bash
git add src/routes/courier/services/new/+page.svelte src/routes/courier/services/+page.svelte
git commit -m "refactor: replace sessionStorage warning with URL search params"
```

---

### Task 10: Refactor Courier Layout Nav to Slice Pattern

**Files:**
- Modify: `src/routes/courier/+layout.svelte`

**Context:** Courier layout has 3 separate arrays for nav items. Client layout uses `allNavItems.slice()`. Apply the same pattern. Bottom nav = first 4 items, more items = rest.

**Step 1: Replace duplicated arrays**

Replace lines 32-44 (the `bottomNavItems` and `moreItems` definitions) with:

```typescript
const bottomNavItems = $derived(allNavItems.slice(0, 4));
const moreItems = $derived(allNavItems.slice(4));
```

**Step 2: Verify**

Run: `pnpm run check`

**Step 3: Commit**

```bash
git add src/routes/courier/+layout.svelte
git commit -m "refactor: use slice pattern for courier nav items"
```

---

### Task 11: Delete Redundant +page.ts

**Files:**
- Delete: `src/routes/courier/services/new/+page.ts`

**Context:** This file only passes `supabase` from parent, which is already available from the root layout.

**Step 1: Delete the file**

```bash
git rm src/routes/courier/services/new/+page.ts
```

**Step 2: Verify**

Run: `pnpm run check`
Expected: 0 errors — the page loads `data.supabase` from the root layout anyway.

**Step 3: Commit**

```bash
git commit -m "chore: delete redundant +page.ts in courier services/new"
```

---

## Phase 5: Type Safety

### Task 12: Regenerate Database Types and Remove `as any` Casts

**Files:**
- Modify: `src/lib/database.types.ts`
- Modify: `src/routes/client/services/[id]/edit/+page.server.ts`
- Modify: `src/routes/courier/services/new/+page.server.ts`
- Modify: `src/routes/client/+page.server.ts`

**Context:** The generated types are out of sync with the actual schema, causing `(supabase as any)` casts. Regenerate types, then remove casts.

**Step 1: Regenerate types**

Use `mcp__supabase__generate_typescript_types` to get fresh types. Write the output to `src/lib/database.types.ts`.

**Step 2: Remove `as any` casts**

In each of the 3 server files, find `(supabase as any)` and replace with just `supabase`. If TypeScript still complains after type regeneration, the types may need manual adjustment for specific fields — investigate and fix.

**Step 3: Also remove `eslint-disable` comments**

Remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments that precede each cast.

**Step 4: Verify**

Run: `pnpm run check`
Expected: 0 errors. If there are type errors, investigate which fields are missing and update the types accordingly.

**Step 5: Commit**

```bash
git add src/lib/database.types.ts src/routes/client/services/[id]/edit/+page.server.ts \
  src/routes/courier/services/new/+page.server.ts src/routes/client/+page.server.ts
git commit -m "fix: regenerate database types and remove supabase as any casts"
```

---

## Phase 6: Final Verification

### Task 13: Full Build Check

**Step 1: Run type check**

```bash
pnpm run check
```

Expected: 0 errors

**Step 2: Run build**

```bash
pnpm run build
```

Expected: Build succeeds

**Step 3: Update implementation plan**

Mark all tasks as complete in this file.

---

## Completion Checklist

- [x] Phase 1: P1-1 price recalculation removed
- [x] Phase 1: P1-2 batch ops routed through server actions
- [x] Phase 2: usePagination composable created
- [x] Phase 2: PaginationControls component created
- [x] Phase 2: Pagination applied to 4 pages, shadcn deleted
- [x] Phase 3: i18n keys added to en.json and pt-PT.json
- [x] Phase 3: Hardcoded strings replaced with m.xxx()
- [x] Phase 4: Calendar SVGs replaced with Lucide
- [x] Phase 4: sessionStorage replaced with URL params
- [x] Phase 4: Courier layout nav refactored to slice
- [x] Phase 4: Redundant +page.ts deleted
- [x] Phase 5: Database types regenerated, `as any` removed
- [x] Phase 6: `pnpm run check` passes
- [x] Phase 6: `pnpm run build` passes
