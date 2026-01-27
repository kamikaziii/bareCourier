---
status: complete
priority: p3
issue_id: "148"
tags: [frontend, code-duplication, components]
dependencies: []
---

# Extract Shared ServiceLocationCard Component

## Problem Statement
The locations card (pickup/delivery labels, separator, RouteMap, distance fallback) is structurally identical between courier and client detail views.

## Findings
- Source: Pattern Recognition Specialist (full review 2026-01-27)
- Locations:
  - `src/routes/courier/services/[id]/+page.svelte:344-378`
  - `src/routes/client/services/[id]/+page.svelte:253-287`

## Proposed Solutions

### Option 1: Create ServiceLocationCard.svelte
- Props: service (with pickup/delivery locations and coords)
- Renders pickup/delivery labels, RouteMap, distance
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] `$lib/components/ServiceLocationCard.svelte` created
- [ ] Both detail views use the shared component
