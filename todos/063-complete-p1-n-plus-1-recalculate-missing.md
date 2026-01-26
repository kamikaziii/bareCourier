---
status: complete
priority: p1
issue_id: "063"
tags: [performance, data, n-plus-1]
dependencies: []
---

# N+1 Query in recalculateMissing

## Problem Statement
Executes calculateServicePrice + UPDATE for each service in parallel, causing query explosion.

## Findings
- Location: `src/routes/courier/billing/[client_id]/+page.server.ts:182`
- Each service triggers: client_pricing query + pricing_zones query + UPDATE
- At 100 services: ~300 database queries
- Parallel execution doesn't solve the query count problem

## Proposed Solutions

### Option 1: Batch pricing calculation
- **Pros**: Fetch config once, batch update all services
- **Cons**: Requires refactoring pricing logic
- **Effort**: Medium
- **Risk**: Low

### Option 2: Create RPC function
- **Pros**: Single round trip, atomic
- **Cons**: Requires migration
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
Fetch client pricing config once, then batch update all services via RPC

## Technical Details
- **Affected Files**: src/routes/courier/billing/[client_id]/+page.server.ts
- **Database Changes**: Yes - new RPC function for bulk price update

## Acceptance Criteria
- [x] Config fetched once per batch
- [x] Single RPC call updates all prices
- [x] Performance scales O(1) not O(n)

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System
**Actions:** Issue approved during triage session

### 2026-01-26 - Resolved
**By:** Claude Code
**Actions:**
- Created RPC function `bulk_recalculate_service_prices` (migration 032)
- Updated `src/routes/courier/billing/[client_id]/+page.server.ts` to use RPC
- Config is now fetched once by the RPC function internally
- Performance now O(1) regardless of service count

## Notes
Source: Full codebase review 2026-01-26 (CRIT-002)
