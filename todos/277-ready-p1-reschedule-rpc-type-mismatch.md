---
status: ready
priority: p1
issue_id: "277"
tags: [bug, database, rpc, type-mismatch]
dependencies: []
---

# reschedule_service RPC Type Mismatch (text vs time)

## Problem Statement
`supabase db lint --linked` reports: column `scheduled_time` is `time without time zone` but `p_new_time` parameter is `text`. The assignment `scheduled_time = p_new_time` fails without an explicit cast. Same issue exists in `bulk_reschedule_services`.

## Findings
- Confirmed by `supabase db lint --linked` output
- Location: `supabase/migrations/20260205000002_fix_rpc_exception_rollback.sql:91`
- Same pattern in `20260121000040_fix_bulk_reschedule_auth_bypass.sql:89`
- `p_new_time` declared as `text DEFAULT NULL` at line 11
- Error: "You will need to rewrite or cast the expression" (sqlState 42804)

## Proposed Solutions

### Option 1: Cast p_new_time to time in the UPDATE
- Change `scheduled_time = p_new_time` to `scheduled_time = p_new_time::time`
- Apply to both `reschedule_service` and `bulk_reschedule_services`
- **Pros**: Minimal change, keeps function signature stable
- **Cons**: None
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Recommended Action
Add `::time` cast in both RPC functions.

## Technical Details
- **Affected Files**: New migration file to CREATE OR REPLACE both functions
- **Related Components**: Courier reschedule, bulk reschedule
- **Database Changes**: Yes — function replacement

## Acceptance Criteria
- [ ] `supabase db lint` no longer reports type mismatch
- [ ] Courier can reschedule services with specific times
- [ ] Bulk reschedule works with time values

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06, DB lint output
