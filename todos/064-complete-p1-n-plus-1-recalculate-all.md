---
status: complete
priority: p1
issue_id: "064"
tags: [performance, data, n-plus-1]
dependencies: ["063"]
---

# N+1 Query in recalculateAll

## Problem Statement
Same unbounded parallel queries as recalculateMissing - executes pricing calculation for each service individually.

## Findings
- Location: `src/routes/courier/billing/[client_id]/+page.server.ts:264`
- Same pattern as recalculateMissing
- Scales poorly with service count

## Proposed Solutions

### Option 1: Share RPC with recalculateMissing
- **Pros**: Single implementation for both
- **Cons**: None
- **Effort**: Small (if 063 done first)
- **Risk**: Low

## Recommended Action
Use same RPC function created for recalculateMissing (todo #063)

## Technical Details
- **Affected Files**: src/routes/courier/billing/[client_id]/+page.server.ts
- **Database Changes**: Shares RPC from #063

## Acceptance Criteria
- [x] Uses same bulk RPC as recalculateMissing
- [x] Performance scales O(1) not O(n)

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System
**Actions:** Issue approved during triage session

### 2026-01-26 - Resolved
**By:** Claude Code
**Actions:**
- Uses same `bulk_recalculate_service_prices` RPC as recalculateMissing (#063)
- Updated action in `src/routes/courier/billing/[client_id]/+page.server.ts`
- Performance now O(1) regardless of service count

## Notes
Source: Full codebase review 2026-01-26 (CRIT-003)
