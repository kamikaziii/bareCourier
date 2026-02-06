---
status: complete
priority: p2
issue_id: "281"
tags: [bug, database, rpc, error-handling]
dependencies: ["277"]
---

# bulk_reschedule_services Swallows Exceptions and Leaks SQLERRM

## Problem Statement
`bulk_reschedule_services` (migration line 130-136) catches `EXCEPTION WHEN OTHERS` and returns JSON with raw `SQLERRM`. This was the exact pattern fixed in `20260205000002` for the other three reschedule RPCs, but `bulk_reschedule_services` was missed. Also leaks internal error details to the client.

## Findings
- Location: `supabase/migrations/20260121000040_fix_bulk_reschedule_auth_bypass.sql:130-136`
- Fixed pattern: `20260205000002_fix_rpc_exception_rollback.sql` (fixes 3 other RPCs)
- `SQLERRM` exposed directly in error response (line 133)

## Proposed Solutions

### Option 1: Apply same fix as other RPCs
- Replace EXCEPTION handler with `RAISE WARNING` + `RAISE` pattern
- Return generic error message instead of SQLERRM
- **Pros**: Consistent with other RPCs, proper rollback, no info leak
- **Cons**: None
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Recommended Action
Apply the same exception handling pattern used in the other reschedule RPCs.

## Technical Details
- **Affected Files**: New migration file
- **Database Changes**: Yes — function replacement

## Acceptance Criteria
- [ ] Exceptions propagate properly (trigger rollback)
- [ ] No SQLERRM leaked to client
- [ ] Bulk reschedule still works for success case

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

### 2026-02-06 - Fixed
**Migration:** `supabase/migrations/20260206000001_fix_reschedule_rpc_type_and_exceptions.sql`
**Changes:** Replaced `EXCEPTION WHEN OTHERS` handler that returned JSON with `SQLERRM` with `RAISE WARNING` + `RAISE` pattern matching the other reschedule RPCs. Combined with #277 fix in same migration.

## Notes
Source: Comprehensive audit session on 2026-02-06
