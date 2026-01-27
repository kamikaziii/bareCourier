---
status: ready
priority: p2
issue_id: "143"
tags: [frontend, code-duplication, refactor]
dependencies: []
---

# Extract Shared Distance Calculation Utility

## Problem Statement
Nearly identical distance-calculation logic (try courierSettings -> calculateServiceDistance, else calculateRoute, fallback haversine, then fetch route geometry) is copy-pasted across 3 files.

## Findings
- Source: Pattern Recognition Specialist (full review 2026-01-27)
- Locations:
  - `src/routes/courier/services/+page.svelte:211-253`
  - `src/routes/courier/services/[id]/edit/+page.svelte:106-134`
  - `src/routes/client/new/+page.svelte:92-131`

## Proposed Solutions

### Option 1: Extract to $lib/services/route.ts
- Create `calculateRouteIfReady(pickup, delivery, courierSettings)` function
- Returns `{ distanceKm, routeGeometry, warehouseBreakdown }`
- All 3 files import and call it
- **Effort**: Medium (1-2 hours)
- **Risk**: Low

## Acceptance Criteria
- [ ] Shared utility in `$lib/services/route.ts`
- [ ] All 3 files use the shared function
- [ ] No duplicated distance calc logic remains
