---
status: complete
priority: p1
issue_id: "062"
tags: [performance, data, n-plus-1]
dependencies: []
---

# N+1 Query in batchReschedule

## Problem Statement
Iterating over services array executing individual UPDATE + INSERT queries per service in the batch reschedule operation.

## Findings
- Location: `src/routes/courier/+page.server.ts:96`
- Loop executes UPDATE + INSERT + notification queries per service
- At 100 services: ~300 database queries
- Performance degrades linearly with service count

## Proposed Solutions

### Option 1: Batch update with .in() filter
- **Pros**: Simple, uses existing Supabase client
- **Cons**: Still multiple queries for history/notifications
- **Effort**: Small
- **Risk**: Low

### Option 2: Create Postgres RPC function
- **Pros**: Single database round trip, atomic
- **Cons**: More complex, requires migration
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
Create RPC function for bulk reschedule that handles all operations atomically

## Technical Details
- **Affected Files**: src/routes/courier/+page.server.ts
- **Database Changes**: Yes - new RPC function

## Acceptance Criteria
- [x] Batch reschedule uses single RPC call
- [x] All operations are atomic
- [x] Performance scales O(1) not O(n)

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System
**Actions:** Issue approved during triage session

### 2026-01-26 - Resolved
**By:** Claude Code
**Actions:**
- Created RPC function `bulk_reschedule_services` (migration 034)
- Updated `src/routes/courier/+page.server.ts` to use single RPC call
- Removed N+1 loop pattern
- Performance now O(1) regardless of service count

## Notes
Source: Full codebase review 2026-01-26 (CRIT-001)
