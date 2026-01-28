# UX Audit Fixes — Design Document

**Date**: 2026-01-27
**Source**: Full UX audit of bareCourier app

## Scope

11 fixes from UX audit findings. 2 findings skipped (client pricing on detail page, breadcrumbs).

---

## 1. Remove Dead Routes

**Finding**: `/courier/reports` and `/courier/analytics` are placeholder pages.

**Fix**: Replace both with server-side `redirect(303, '/courier/insights')` in `+page.server.ts`. Remove any nav links pointing to these routes.

**Files**:
- `src/routes/courier/reports/+page.server.ts` — add redirect
- `src/routes/courier/analytics/+page.server.ts` — add redirect
- Delete `+page.svelte` for both if redirect is in server load
- Search layouts/nav for stale links

---

## 2. Client Edit for Pending Requests

**Finding**: Client cannot edit a service request before courier accepts it.

**Fix**: Add `/client/services/[id]/edit` route. Only accessible when `request_status = 'pending'`. Reuse the same form fields as `/client/new` (address inputs, schedule picker, notes). Pre-populate with current values.

**Constraints**:
- RLS: Client can only update own services. Need an RLS policy allowing client UPDATE on services where `client_id = auth.uid()` AND `request_status = 'pending'`.
- Hide edit button on detail page when `request_status != 'pending'`.

**Files**:
- `src/routes/client/services/[id]/edit/+page.svelte` — new
- `src/routes/client/services/[id]/edit/+page.ts` — load service data
- `src/routes/client/services/[id]/+page.svelte` — add edit button (conditional)
- Migration: RLS policy for client UPDATE on pending services

---

## 3. Client Dashboard Sort Dropdown

**Finding**: Client dashboard has no sorting controls.

**Fix**: Add a sort dropdown above the service list with options:
- Newest first (default)
- Oldest first
- Status (pending first)
- Status (delivered first)

Sorting is client-side since data is already loaded.

**Files**:
- `src/routes/client/+page.svelte` — add sort dropdown + sort logic

---

## 4. Client Calendar (Read-Only)

**Finding**: Courier has `/courier/calendar`, client has none.

**Fix**: Add `/client/calendar` with a read-only calendar grid showing the client's own services. Reuse the calendar grid logic from courier's calendar. Services shown as colored dots (blue=pending, green=delivered). Day click shows service list in side panel. No status-change actions.

**Files**:
- `src/routes/client/calendar/+page.svelte` — new
- `src/routes/client/calendar/+page.ts` — load client services
- Extract shared calendar components if courier's implementation allows reuse
- Update client nav layout to include Calendar link

---

## 5. Shared EmptyState Component

**Finding**: Empty states vary across pages — some styled, some plain, some without CTAs.

**Fix**: Create `src/lib/components/EmptyState.svelte` with props:
- `icon` — Lucide icon component
- `title` — heading text
- `description` — body text
- `actionLabel` — optional CTA button text
- `actionHref` — optional CTA link
- `onAction` — optional CTA callback

Apply to all list pages: courier services, courier requests, courier clients, courier billing, client dashboard, client billing, client calendar.

**Files**:
- `src/lib/components/EmptyState.svelte` — new
- All list page files — replace ad-hoc empty states

---

## 6. "Needs Attention" Section on Client Dashboard

**Finding**: Client request statuses (suggested dates, rejections) are buried in the service list.

**Fix**: Add a prominent section at the top of the client dashboard, above the service list. Shows:
- Services with `request_status = 'suggested'` — "Courier suggested a new date"
- Services with `request_status = 'rejected'` — "Request was declined"

Each card has inline actions (accept/decline suggestion, or re-submit with changes). Section hidden when no actionable items exist. Uses a distinct visual style (e.g., warning/info card background).

**Files**:
- `src/routes/client/+page.svelte` — add section above service list

---

## 7. Pagination on Major Lists

**Finding**: Only `/courier/clients/[id]` has pagination. All other lists load everything.

**Fix**: Add consistent pagination (20 items/page) to:
- `/courier/services`
- `/courier/billing`
- `/client` (dashboard)
- `/client/billing`

Pattern: Server-side pagination using Supabase `.range(from, to)`. URL params `?page=1` for bookmarkability. Shared `Pagination` component with prev/next + page indicator.

**Files**:
- `src/lib/components/Pagination.svelte` — new (or use shadcn-svelte pagination)
- Each list page — add range query + pagination controls

---

## 8. Client Batch Accept/Decline for Suggestions

**Finding**: Client must handle suggested date changes one by one.

**Fix**: Add batch selection mode to the "Needs attention" section (Finding 6). Checkboxes on suggestion cards. Floating action bar with "Accept all" / "Decline all" buttons. Decline requires a reason (single input applied to all).

**Files**:
- `src/routes/client/+page.svelte` — batch selection + actions on needs-attention section

---

## 9. Shared "More" Drawer for Client Nav

**Finding**: Client nav has 4 items. Adding calendar makes 5, which overflows mobile bottom nav.

**Fix**: Extract the courier's "More" drawer pattern into a shared component. Apply to client nav. Show first 4 items in bottom bar, 5th+ in "More" drawer. This means: Dashboard, Services, Calendar, More (containing Billing, Settings).

**Files**:
- `src/lib/components/MobileMoreDrawer.svelte` — new (extract from courier layout)
- `src/routes/client/+layout.svelte` — use shared drawer
- `src/routes/courier/+layout.svelte` — refactor to use shared drawer

---

## 10. Move Courier Create to `/courier/services/new`

**Finding**: Courier services page combines list + complex create form.

**Fix**: Extract the creation form from `/courier/services/+page.svelte` into a new route `/courier/services/new/+page.svelte`. Add a "New Service" button on the list page. The create form keeps all existing functionality (client selector, address autocomplete, map, pricing, scheduling).

**Files**:
- `src/routes/courier/services/new/+page.svelte` — new (moved from services page)
- `src/routes/courier/services/new/+page.ts` — load clients, urgency fees, pricing
- `src/routes/courier/services/+page.svelte` — remove form, add "New Service" button

---

## 11. Align Client Settings Responsive Pattern

**Finding**: Courier settings uses tab-to-dropdown on mobile. Client settings may not match.

**Fix**: Verify client settings uses the same responsive pattern. If not, refactor to use the same tab/dropdown component. Extract shared `ResponsiveTabs` if needed.

**Files**:
- `src/routes/client/settings/+page.svelte` — verify/fix
- Possibly extract shared tab component
