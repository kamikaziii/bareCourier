---
status: complete
priority: p3
issue_id: "313"
tags: [data-integrity, supabase, race-condition]
dependencies: []
---

# bulk_reschedule_services Missing FOR UPDATE Lock on State Capture

## Problem Statement

The `bulk_reschedule_services` function SELECTs service state into a temp table without `FOR UPDATE` locking. The individual `reschedule_service` function was specifically fixed with `FOR UPDATE` in migration `20260205000001`. A concurrent modification between the SELECT and UPDATE in the bulk function could result in stale values being written to the reschedule history record.

## Findings

- Migration `20260206000004_fix_reschedule_rpc_type_and_exceptions.sql` (lines 233-237) captures current service state without locking:
  ```sql
  -- Captures state into temp table without FOR UPDATE
  SELECT scheduled_date, scheduled_time_slot, scheduled_time, ...
  INTO v_current_state
  FROM services WHERE id = ...;
  -- Gap here where concurrent modification can occur
  UPDATE services SET ...;
  ```
- The individual `reschedule_service` function was explicitly fixed with `FOR UPDATE` in migration `20260205000001` to prevent this exact race condition
- In the bulk function, if another process modifies the service between the SELECT and UPDATE:
  - The history record would contain stale "before" values
  - The actual state change would still apply correctly (UPDATE is atomic)
  - Impact is limited to incorrect audit trail data
- Practical risk is low since only the courier performs reschedules and bulk operations are typically done sequentially

**Affected file:** `supabase/migrations/20260206000004_fix_reschedule_rpc_type_and_exceptions.sql` lines 233-237

## Proposed Solutions

### Option 1: Lock Rows Before State Capture

**Approach:** The current pattern uses `INSERT INTO temp_table SELECT ... FROM services`, which does NOT support `FOR UPDATE` directly. Instead, lock the target rows first with a separate `SELECT ... FOR UPDATE`, then capture state into the temp table.

```sql
-- Step 1: Lock the rows
PERFORM 1 FROM public.services
WHERE id = ANY(p_service_ids) AND status = 'pending'
FOR UPDATE;

-- Step 2: Capture current state (rows are now locked)
INSERT INTO temp_services_to_update (id, client_id, old_date, old_time_slot, old_time)
SELECT s.id, s.client_id, s.scheduled_date, s.scheduled_time_slot, s.scheduled_time
FROM public.services s
WHERE s.id = ANY(p_service_ids)
  AND s.status = 'pending';
```

**Pros:**
- Consistent with the fix applied to `reschedule_service`
- Prevents race condition on state capture
- Standard database pattern for atomic read-modify-write

**Cons:**
- May increase lock contention during bulk operations (all rows locked for full transaction)
- Minimal practical impact given single-courier usage
- Two queries instead of one (slight overhead)

**Effort:** 15-30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260206000004_fix_reschedule_rpc_type_and_exceptions.sql` - bulk_reschedule_services()
- New migration required

**Related:**
- `supabase/migrations/20260205000001` - fix that added FOR UPDATE to individual reschedule_service

**Database changes:**
- Migration needed: Yes
- Updated function: `bulk_reschedule_services()`
- Add `FOR UPDATE` to state capture SELECT

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review
- **Precedent:** Migration `20260205000001` fixed this same issue for `reschedule_service`

## Acceptance Criteria

- [ ] State capture SELECT in bulk_reschedule_services uses `FOR UPDATE`
- [ ] Bulk reschedule operations still work correctly
- [ ] Reschedule history records contain accurate "before" state
- [ ] No deadlock issues introduced with the locking
- [ ] Migration applied with `supabase db push`

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Compared bulk_reschedule_services with individual reschedule_service
- Identified missing FOR UPDATE lock on state capture
- Confirmed the individual function was specifically fixed for this issue
- Assessed impact as limited to audit trail accuracy

**Learnings:**
- When a pattern is fixed in one function, all similar functions should be checked
- Bulk operations that loop over individual records are prone to missing fixes applied to the individual operation
- FOR UPDATE is the standard pattern for atomic read-modify-write in PostgreSQL
