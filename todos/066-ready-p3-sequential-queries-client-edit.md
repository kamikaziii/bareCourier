---
status: ready
priority: p3
issue_id: "066"
tags: [performance, data]
dependencies: []
---

# Sequential Queries in Client Edit Load

## Problem Statement
Three sequential queries in load function: profiles, client_pricing, pricing_zones.

## Findings
- Location: `src/routes/courier/clients/[id]/edit/+page.server.ts:13`
- Same pattern as client detail page
- Unnecessary latency on page load

## Proposed Solutions

### Option 1: Promise.all
- **Pros**: Simple fix
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Wrap all three queries in Promise.all

## Technical Details
- **Affected Files**: src/routes/courier/clients/[id]/edit/+page.server.ts
- **Database Changes**: No

## Acceptance Criteria
- [ ] All queries execute in parallel
- [ ] Page load time reduced

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System
**Actions:** Issue approved during triage session

### 2026-01-26 - Downgraded P1 → P3
**By:** Claude Verification
**Reason:** Single-entity page with fixed 3 queries regardless of scale. Minor latency optimization, not a scaling bottleneck.

## Notes
Source: Full codebase review 2026-01-26 (CRIT-005)
