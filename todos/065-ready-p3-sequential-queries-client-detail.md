---
status: ready
priority: p3
issue_id: "065"
tags: [performance, data]
dependencies: []
---

# Sequential Queries in Client Detail Load

## Problem Statement
Four sequential queries in load function: profiles, services, client_pricing, pricing_zones - causes unnecessary latency.

## Findings
- Location: `src/routes/courier/clients/[id]/+page.server.ts:25`
- Each query waits for previous to complete
- ~4x latency compared to parallel execution

## Proposed Solutions

### Option 1: Promise.all
- **Pros**: Simple fix, no schema changes
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Wrap all four queries in Promise.all for parallel execution

## Technical Details
- **Affected Files**: src/routes/courier/clients/[id]/+page.server.ts
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
**Reason:** Single-entity page with fixed 4 queries regardless of scale. Minor latency optimization, not a scaling bottleneck.

## Notes
Source: Full codebase review 2026-01-26 (CRIT-004)
