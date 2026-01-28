# Review Fixes — Design Document

**Date**: 2026-01-28
**Source**: Multi-agent code review of UX audit implementation (15 commits, 32 files)

## Scope

12 findings from 5 review agents (security, architecture, performance, simplicity, pattern recognition). All accepted for fix.

---

## 1. Remove Price Recalculation from Client Edit

**Finding**: Client edit server action recalculates `calculated_price` and `price_breakdown`, but the RLS trigger (migration 034) always blocks clients from modifying these fields. Edit fails when price changes.

**Fix**: Remove the pricing pipeline from `+page.server.ts`. Only update location, notes, schedule, coordinates, distance, and urgency fields. Courier owns pricing — they recalculate when reviewing the edited request.

**Files**:
- `src/routes/client/services/[id]/edit/+page.server.ts` — remove pricing imports, settings fetch, price calculation, and price fields from UPDATE

---

## 2. Route Batch Accept/Decline Through Server Actions

**Finding**: Batch accept/decline calls `data.supabase` directly from the client, bypassing server-side ownership verification. The trigger also blocks `scheduled_date`/`scheduled_time_slot` for clients, making batch accept non-functional.

**Fix**: Create two new server actions (`batchAcceptSuggestions`, `batchDeclineSuggestions`) in `+page.server.ts`. Each accepts an array of service IDs, verifies ownership, and performs a single bulk UPDATE. Remove the `batchDeclineReason` textarea (never stored). Update the client-side handlers to call server actions via `fetch()`.

**Constraints**:
- Server action must verify `client_id = user.id` for all IDs before updating.
- Batch accept must copy `suggested_date`/`suggested_time_slot` to `scheduled_date`/`scheduled_time_slot` and clear suggested fields — same as the existing individual `acceptSuggestion` action.
- Batch decline must reset `request_status` to `pending` and clear suggested fields.
- Use `supabase as any` cast (same pattern as individual actions) until types are regenerated (finding 10).

**Files**:
- `src/routes/client/+page.server.ts` — add `batchAcceptSuggestions` and `batchDeclineSuggestions` actions
- `src/routes/client/+page.svelte` — replace direct Supabase calls with fetch to server actions; remove `batchDeclineReason` state and textarea from dialog

---

## 3. Add i18n Keys for Hardcoded Strings

**Finding**: 15+ user-facing strings bypass the paraglide i18n system.

**Fix**: Add message keys to all paraglide message files. Replace hardcoded strings with `m.xxx()` calls.

**Strings to add** (grouped by file):
- Client dashboard: "Needs your attention", "Courier suggested a new date", "Request was declined", "Respond", "Re-submit with changes", "Accept all", "Decline all", "X selected", "Newest first", "Oldest first", "Pending first", "Delivered first", "Decline Selected Suggestions", "This will reset N suggestion(s) back to pending."
- Client edit: "Edit Service Request", "Update your pending service request", "Save Changes"
- Courier services empty state: "Create your first service to get started."
- Client dashboard empty state: "Create your first request to get started."
- Pagination (4 pages): "Previous", "Next", "Page X of Y"

**Files**:
- `src/lib/paraglide/messages/en.json` (and other locales) — add keys
- `src/routes/client/+page.svelte` — replace hardcoded strings
- `src/routes/client/services/[id]/edit/+page.svelte` — replace hardcoded strings
- `src/routes/courier/services/+page.svelte` — replace empty state string
- All 4 pagination pages — replace "Previous"/"Next"/"Page X of Y"

---

## 4. Extract Pagination Composable and Component

**Finding**: Identical pagination logic copy-pasted in 4 files. Installed shadcn pagination component (10 files) never used.

**Fix**: Create `usePagination` composable and `PaginationControls.svelte` component. Delete unused shadcn pagination files.

**Composable API** (`src/lib/composables/use-pagination.svelte.ts`):
```typescript
export function usePagination<T>(items: () => T[], pageSize = 20) {
  let currentPage = $state(1);
  const totalPages = $derived(Math.ceil(items().length / pageSize));
  const paginatedItems = $derived(items().slice((currentPage - 1) * pageSize, currentPage * pageSize));
  function reset() { currentPage = 1; }
  function prev() { if (currentPage > 1) currentPage--; }
  function next() { if (currentPage < totalPages) currentPage++; }
  return { /* getters + methods */ };
}
```

**Component API** (`src/lib/components/PaginationControls.svelte`):
- Props: `currentPage`, `totalPages`, `onPrev`, `onNext`
- Renders: Previous button, "Page X of Y", Next button
- Uses i18n keys from finding 3

**Files**:
- `src/lib/composables/use-pagination.svelte.ts` — new
- `src/lib/components/PaginationControls.svelte` — new
- `src/routes/client/+page.svelte` — use composable + component
- `src/routes/client/billing/+page.svelte` — use composable + component
- `src/routes/courier/services/+page.svelte` — use composable + component
- `src/routes/courier/billing/+page.svelte` — use composable + component
- `src/lib/components/ui/pagination/` — delete all 10 files + directory

---

## 5. Fix Import Extension

**Finding**: `src/routes/client/+page.svelte` imports `useBatchSelection` without `.js` extension, violating ESM convention.

**Fix**: Change `'$lib/composables/use-batch-selection.svelte'` to `'$lib/composables/use-batch-selection.svelte.js'`.

**Files**:
- `src/routes/client/+page.svelte` — fix import path

---

## 6. Replace Calendar Inline SVGs with Lucide Icons

**Finding**: Calendar uses hand-rolled `<svg>` elements for chevron navigation instead of Lucide icons used everywhere else.

**Fix**: Import `ChevronLeft`, `ChevronRight` from `@lucide/svelte`. Replace inline SVGs.

**Files**:
- `src/routes/client/calendar/+page.svelte` — replace SVGs with Lucide components

---

## 7. Replace sessionStorage with URL Search Params

**Finding**: Courier service creation stores warnings via `sessionStorage`. Fragile pattern that bypasses SvelteKit's data flow.

**Fix**: After successful service creation, redirect to `/courier/services?warning=no_pricing`. On the list page, read from `$page.url.searchParams` and clear with `replaceState`.

**Files**:
- `src/routes/courier/services/new/+page.server.ts` — change redirect to include `?warning=` param
- `src/routes/courier/services/new/+page.svelte` — remove sessionStorage write
- `src/routes/courier/services/+page.svelte` — read from URL params instead of sessionStorage

---

## 8. Regenerate Database Types

**Finding**: `database.types.ts` is out of sync with schema, causing `(supabase as any)` casts in server actions.

**Fix**: Use `mcp__supabase__generate_typescript_types` to regenerate. Then remove all `as any` casts on Supabase client calls.

**Files**:
- `src/lib/database.types.ts` — regenerate
- `src/routes/client/services/[id]/edit/+page.server.ts` — remove `as any`
- `src/routes/courier/services/new/+page.server.ts` — remove `as any`
- `src/routes/client/+page.server.ts` — remove `as any`

---

## 9. Refactor Courier Layout Nav to Slice Pattern

**Finding**: Courier layout manually duplicates nav items in 3 separate arrays. Client layout uses cleaner `slice()` approach.

**Fix**: Define `allNavItems` once, derive `bottomNavItems` and `moreItems` via `slice()`.

**Files**:
- `src/routes/courier/+layout.svelte` — refactor to slice pattern

---

## 10. Delete Redundant +page.ts

**Finding**: `src/routes/courier/services/new/+page.ts` only passes `supabase` from parent, which is already available via root layout.

**Fix**: Delete the file.

**Files**:
- `src/routes/courier/services/new/+page.ts` — delete
