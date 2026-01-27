# UX Audit Report — bareCourier

**Date**: 2026-01-27
**Scope**: Full audit (all routes, roles, patterns, IA)
**Pages audited**: 18 (13 courier + 5 client)
**User roles**: courier, client

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 5 |
| Medium | 6 |
| Low | 4 |

---

## Route Map

| Route | Role | Page Intent | Key Features |
|-------|------|-------------|--------------|
| `/courier` | courier | Dashboard — today's services overview | filters, batch selection, inline status toggle, pull-to-refresh |
| `/courier/services` | courier | Services list + create form | search, status/client filter, create form |
| `/courier/services/[id]` | courier | Service detail | tabs (details/history), status change, reschedule, price override, delete |
| `/courier/services/[id]/edit` | courier | Edit service | form (client, locations, notes) |
| `/courier/clients` | courier | Clients list + create | create form, active/inactive separation |
| `/courier/clients/[id]` | courier | Client detail | tabs (info/services/billing), stats, pricing config |
| `/courier/clients/[id]/edit` | courier | Edit client info + pricing | form + zone pricing |
| `/courier/requests` | courier | Manage service requests | accept/reject/suggest, reschedule approvals |
| `/courier/calendar` | courier | Calendar view | month grid, day detail panel, service dots |
| `/courier/billing` | courier | Billing overview | date range, client table, CSV export |
| `/courier/billing/[client_id]` | courier | Client billing detail | pricing config, services table, CSV, recalculate |
| `/courier/insights` | courier | Analytics | tabs (overview/charts/data), date range |
| `/courier/settings` | courier | Settings | tabs/dropdown (account/pricing/scheduling/notifications) |
| `/client` | client | Dashboard — my services | status filter, search, cancel, respond to suggestions |
| `/client/new` | client | Create service request | address autocomplete, map, scheduling, urgency |
| `/client/services/[id]` | client | Service detail | tabs (details/history), reschedule |
| `/client/billing` | client | Billing history | date range, services table, CSV export |
| `/client/settings` | client | Profile + notifications | name, phone, location, push/email toggles |

---

## Findings

### [HIGH] H1 — Batch selection missing from courier services list

- **Location**: `src/routes/courier/services/+page.svelte`
- **Issue**: Dashboard has batch selection (select multiple → batch reschedule), but the services list page — which shows the same data with more filters — has no batch selection at all.
- **Context**: If a courier wants to batch-reschedule services they found via search or client filter, they must go back to the dashboard. The services list is the primary data management page and should have feature parity with the dashboard.
- **Recommendation**: Add batch selection mode + batch reschedule to the services list page, mirroring the dashboard pattern.

### [HIGH] H2 — Client has no calendar view

- **Location**: `src/routes/client/+layout.svelte` (nav items)
- **Issue**: Courier has a full calendar view (`/courier/calendar`) showing services per day. Client has no equivalent way to see their services on a calendar, even though clients schedule pickups with specific dates.
- **Context**: Clients request services with dates and time slots. A calendar view would help them see upcoming pickups at a glance.
- **Recommendation**: Add `/client/calendar` with a simplified calendar view (read-only, showing the client's own services).

### [HIGH] H3 — Client dashboard lacks quick date filters

- **Location**: `src/routes/client/+page.svelte`
- **Issue**: Client dashboard has status filters and search, but date filtering is hidden behind an expandable advanced filters section. Courier dashboard uses explicit "Today / Tomorrow / All" buttons.
- **Context**: Clients frequently need to see "today's pickups" or "this week's services." The quick date buttons pattern from the courier dashboard would be more discoverable.
- **Recommendation**: Add Today/Tomorrow/All quick filter buttons to client dashboard, matching the courier pattern.

### [HIGH] H4 — No dispute or issue reporting mechanism

- **Location**: Absent from both roles
- **Issue**: Client can cancel pending services but has no way to flag issues with delivered services (wrong delivery, damage, etc.). There's no feedback or dispute mechanism for either role.
- **Context**: In a real courier operation, clients need to report problems. Currently, the only post-delivery interaction is viewing the detail page.
- **Recommendation**: Add a "Report Issue" action on delivered services (client side), visible to courier in requests or a new disputes section.

### [HIGH] H5 — Batch operations only on dashboard

- **Location**: `src/routes/courier/+page.svelte` vs all other list pages
- **Issue**: Batch selection with batch reschedule exists only on the dashboard. The services list, clients list, billing overview, and requests page all display lists but none support batch operations.
- **Context**: Batch operations are useful on any list. At minimum, the services list should support batch status change (mark multiple as delivered) and the requests page should support batch accept.
- **Recommendation**: Add batch selection to `/courier/services` (batch status change + batch reschedule) and `/courier/requests` (batch accept).

### [MEDIUM] M1 — Inconsistent loading states

- **Location**: Multiple files
- **Issue**: Loading states vary across pages:
  - Dashboard: `SkeletonCard` + `SkeletonList` (best)
  - Services list: `SkeletonList`
  - Clients list: `SkeletonList`
  - Billing pages: `"Loading..."` text
  - Client dashboard: `"Loading..."` text
  - Calendar: No loading state
  - Insights: Tab-level loading
- **Recommendation**: Standardize on skeleton loaders for all data-loading pages. Replace `"Loading..."` text in billing and client pages.

### [MEDIUM] M2 — No sorting on any list page

- **Location**: All list/table pages
- **Issue**: No list page offers user-controlled sorting. Services are always `created_at` descending, clients are alphabetical, billing is by revenue.
- **Recommendation**: Add a sort dropdown to services list (newest, oldest, client name) and client dashboard (newest, oldest, status).

### [MEDIUM] M3 — No pagination on any list page

- **Location**: All list/table pages
- **Issue**: No page has pagination or "load more." All lists load every matching record at once.
- **Context**: For a solo courier app with modest data volumes, this may not be a problem yet. But as services accumulate, performance will degrade.
- **Recommendation**: Add pagination to `/courier/services`, `/courier/billing`, and `/client/billing`. Lower priority unless data volumes are already large.

### [MEDIUM] M4 — Search doesn't include notes

- **Location**: `src/routes/courier/services/+page.svelte` and `src/routes/client/+page.svelte`
- **Issue**: Courier search filters by client name and locations. Client search only filters by locations. Neither searches the notes field.
- **Context**: Users put important details in notes (e.g., "fragile", "ring doorbell"). Notes search would be valuable.
- **Recommendation**: Add notes to the search scope for both roles.

### [MEDIUM] M5 — Client has no insights/analytics

- **Location**: Client routes (absent)
- **Issue**: Courier has a full insights page. Client has no equivalent — just the billing table.
- **Context**: Clients might benefit from simple stats (services per month, total spend trend). However, for a solo courier app, the billing page may be sufficient.
- **Recommendation**: Add basic summary stats to the client billing page header rather than a full analytics page.

### [MEDIUM] M6 — CSV export inconsistency

- **Location**: Billing pages have CSV export; services list pages don't
- **Issue**: Both courier and client billing pages support CSV export. The courier services list and client dashboard — which show similar data — have no export.
- **Context**: If a user filters services and wants to export the filtered list, they must go to billing and re-apply filters.
- **Recommendation**: Add CSV export to `/courier/services` (filtered results).

### [LOW] L1 — Orphan redirect page

- **Location**: `src/routes/courier/analytics/+page.svelte`
- **Issue**: Exists only to redirect to `/courier/insights?tab=charts`. Not linked from navigation.
- **Recommendation**: Keep for bookmark compatibility. Remove eventually.

### [LOW] L2 — Service edit page is minimal compared to create

- **Location**: `src/routes/courier/services/[id]/edit/+page.svelte`
- **Issue**: Create form has address autocomplete, map, distance calculation, scheduling, urgency. Edit form has only basic text inputs — no map, no scheduling, no urgency.
- **Recommendation**: Add address autocomplete and distance recalculation to edit page.

### [LOW] L3 — Different settings layout patterns per role

- **Location**: `src/routes/client/settings/+page.svelte` vs `src/routes/courier/settings/+page.svelte`
- **Issue**: Client settings: stacked cards. Courier settings: tabs/dropdown.
- **Assessment**: **Intentional** — client has 3 small sections (stacking works), courier has 4 complex sections (tabs justified).
- **Recommendation**: No change needed.

### [LOW] L4 — Pricing config editable in two places

- **Location**: `src/routes/courier/clients/[id]/+page.svelte` and `src/routes/courier/billing/[client_id]/+page.svelte`
- **Issue**: Pricing configuration is editable from both the client detail page and the billing detail page.
- **Recommendation**: Consider making pricing on client detail read-only with "Edit in Billing" link.

---

## Feature Parity Matrix

| Feature | Courier | Client | Status |
|---------|---------|--------|--------|
| Dashboard with stats | Present | Present | OK |
| Service list/view | Present | Present | OK |
| Service create | Present | Present | OK |
| Service detail | Present | Present | OK |
| Service edit | Present | Absent | Intentional |
| Service delete | Present | Absent | Intentional |
| Cancel service | Absent | Present | Intentional |
| Status filter | Present | Present | OK |
| Search | Present | Present | OK (scope differs — see M4) |
| Date quick filters (Today/Tomorrow/All) | Present | Absent | **Gap** (H3) |
| Batch selection | Present (dashboard only) | Absent | **Gap** (H5) |
| Calendar view | Present | Absent | **Gap** (H2) |
| Billing/reports | Present (overview + detail) | Present (own billing) | OK |
| CSV export | Present | Present | OK |
| Client management | Present | N/A | Intentional |
| Request management | Present (accept/reject/suggest) | Present (respond) | OK |
| Reschedule | Present (batch + dialog) | Present (dialog) | OK |
| Insights/analytics | Present | Absent | Intentional (see M5) |
| Settings — Account | Present | Present | OK |
| Settings — Pricing | Present | Absent | Intentional |
| Settings — Scheduling | Present | Absent | Intentional |
| Settings — Notifications | Present | Present | OK |
| Dispute/issue reporting | Absent | Absent | **Gap** (H4) |
| Sorting | Absent | Absent | **Gap** (M2) |
| Pagination | Absent | Absent | **Gap** (M3) |

---

## Interaction Pattern Matrix

| Pattern | Courier Dashboard | Courier Services | Courier Clients | Courier Requests | Courier Billing | Client Dashboard | Client Billing |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Search/filter | Yes | Yes | No | No | Yes | Yes | Yes |
| Batch selection | Yes | **No** | No | **No** | No | No | No |
| Sorting | No | No | No | No | Fixed | No | No |
| Pagination | No | No | No | No | No | No | No |
| Export CSV | No | **No** | No | No | Yes | No | Yes |
| Inline actions | Yes | No | No | Yes | No | Yes | No |
| Empty states | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Loading (skeleton) | Yes | Yes | Yes | **No** | **No** | **No** | **No** |
| Pull-to-refresh | Yes | Yes | No | No | No | Yes | No |

**Bold "No"** = inconsistency worth addressing.

---

## Information Architecture

**Courier navigation** (8 items):
- Primary (bottom nav): Dashboard, Services, Requests, Calendar
- Secondary (drawer): Clients, Billing, Insights, Settings
- Hierarchy correctly prioritizes daily workflow

**Client navigation** (4 items):
- My Services, New Request, Billing, Settings
- All primary — appropriate for simpler role
- Potential addition: Calendar as 5th item

**Redundancy**: Pricing config editable from both client detail and billing detail (L4)

**No orphan pages** (except legacy redirect L1)

**No dead ends** — all detail pages have back navigation

---

## Prioritization Notes

**Immediate impact (H1, H5)**: Batch selection on services list — the courier already understands the pattern from the dashboard. Extending it to the services page is a natural expectation.

**User-facing value (H2, H3)**: Client calendar and quick date filters directly improve client experience with minimal complexity.

**Product maturity (H4)**: Dispute mechanism is important for a real courier operation but adds a new workflow. Consider deferring until core features are polished.

**Polish (M1, M6)**: Loading state consistency and CSV export parity are quick wins that improve perceived quality.

**Scale-dependent (M3)**: Pagination matters when data grows. Can defer for a solo courier with low volume.
