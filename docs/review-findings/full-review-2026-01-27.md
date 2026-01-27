# Full Codebase Review — 2026-01-27

**Scope**: 93 app source files (excluding shadcn-svelte UI components)
**Agents**: Security, Performance, Frontend Patterns, Architecture
**Depth**: Standard (two-round)

---

## Executive Summary

The bareCourier codebase is well-structured for its scope. Svelte 5 compliance is 100%, auth patterns are solid, and the PWA architecture is correct. The main issues fall into three categories: **code duplication** (significant, across 6+ patterns), **data layer gaps** (missing pagination, non-atomic writes, duplicate queries), and **security hardening** (error message leaks, cache persistence after logout).

---

## Critical Findings (8)

### Security

| ID | Issue | File | Impact |
|----|-------|------|--------|
| SEC-1 | Raw Supabase error messages leaked to clients | `client/new/+page.server.ts:135` + others | DB schema fingerprinting |
| SEC-2 | Service worker caches sensitive data past logout | `service-worker.ts:109-123` | Data exposure on shared devices |

### Data Layer

| ID | Issue | File | Impact |
|----|-------|------|--------|
| DATA-1 | No pagination on client detail services query | `courier/clients/[id]/+page.server.ts:25-31` | Linear degradation at scale |
| DATA-2 | Redundant profile role check on every form action | 15+ action handlers | Unnecessary DB round-trip per submit |
| DATA-3 | Non-atomic multi-step write in reschedule approval flow | `courier/services/[id]/+page.server.ts:192-253` | Data inconsistency on partial failure |
| DATA-4 | Module-level cached courier ID in serverless | `client/+page.server.ts:6-24` | Stale data risk |

### Architecture

| ID | Issue | File | Impact |
|----|-------|------|--------|
| ARCH-1 | Duplicate Lucide icon packages (`@lucide/svelte` + `lucide-svelte`) | `package.json` | Bundle bloat |
| ARCH-2 | Hand-maintained database types (drift risk) | `database.types.ts` | Type-schema desync |

### Frontend

| ID | Issue | Files | Impact |
|----|-------|-------|--------|
| FE-1 | Distance calculation logic duplicated across 3 files | services/+page, edit/+page, client/new | Maintenance burden |
| FE-2 | Batch selection logic duplicated across 3 files | courier/+page, services/+page, requests/+page | Maintenance burden |
| FE-3 | Status label functions duplicated across 4 files | Multiple | Maintenance burden |

---

## Warnings (19)

### Security (4)
- **WARN-S1**: All cookies serialized and sent to browser in root layout (Supabase SSR trade-off)
- **WARN-S2**: No input length limits on text fields (addresses, notes, reasons)
- **WARN-S3**: Missing date format validation in client reschedule action
- **WARN-S4**: Background sync replays requests with stale auth tokens (JWT expiry)

### Data Layer (6)
- **WARN-D1**: insights-data.ts fetches up to 10K records into browser memory for client-side aggregation
- **WARN-D2**: Sequential notification sends in batch reschedule (should use Promise.all)
- **WARN-D3**: billing/+page.server.ts loads clients and pricing in separate queries (should join)
- **WARN-D4**: client/billing sequential queries could be parallel
- **WARN-D5**: pricing.ts duplicate fetch in calculateServicePrice
- **WARN-D6**: No retry limit on offline pending mutations (infinite sync loop risk)

### Frontend (9)
- **WARN-F1**: Oversized component: courier/services/+page.svelte (649 lines)
- **WARN-F2**: Oversized component: courier/requests/+page.svelte (677 lines)
- **WARN-F3**: Inline SVGs instead of Lucide components in calendar/schedule picker
- **WARN-F4**: Inconsistent native `<select>` styling across files
- **WARN-F5**: Inconsistent error handling (enhance vs raw fetch)
- **WARN-F6**: Duplicated status history rendering (courier vs client detail)
- **WARN-F7**: Duplicated location card rendering (courier vs client detail)
- **WARN-F8**: Duplicated urgency fee select across 3 files
- **WARN-F9**: `$effect(() => { loadData(); })` pattern is fragile (no explicit deps)

### Architecture (4)
- **WARN-A1**: ~80% layout template duplication between courier/client layouts
- **WARN-A2**: courier/+layout.ts and client/+layout.ts are identical pass-through files
- **WARN-A3**: Untyped/inconsistent profile shapes from layout servers (no shared type)
- **WARN-A4**: @sveltejs/adapter-auto still installed but unused

---

## Positives

- 100% Svelte 5 runes compliance — no legacy syntax
- Correct shadcn-svelte import patterns throughout
- Solid auth: safeGetSession() with JWT validation, filtered session tokens
- Good CSV export hardening (date validation, UUID format check, formula injection prevention)
- Atomic RPCs for critical operations (bulk reschedule, zone replacement)
- Proper PWA architecture with offline support and conflict detection
- Consistent i18n via Paraglide (only 2 hardcoded English strings found)
- Well-factored shared constants and navigation types

---

## Recommended Extraction Priority

1. **Shared utilities**: `getStatusLabel`, `getRequestStatusLabel`, `getRequestStatusColor` → `$lib/utils/status.ts`
2. **Shared component**: `ServiceCard.svelte` (service list item rendering)
3. **Shared component**: `ServiceLocationCard.svelte` (pickup/delivery + map)
4. **Shared component**: `StatusHistory.svelte` (timeline rendering)
5. **Shared utility**: `calculateRouteIfReady()` → `$lib/services/route.ts`
6. **Shared composable**: batch selection logic → `$lib/composables/use-batch-selection.ts`
7. **Shared component**: `AppShell.svelte` (layout chrome)
8. **Shared component**: `UrgencyFeeSelect.svelte`
