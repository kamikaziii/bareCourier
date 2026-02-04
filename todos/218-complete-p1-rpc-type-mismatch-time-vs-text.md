---
status: complete
priority: p1
issue_id: "218"
tags: [bug, code-review, database, migration, pr-13]
dependencies: []
---

# RPC Type Mismatch: time Variable vs text Column

## Problem Statement

The `reschedule_service` RPC function declares `v_old_time` as `time` type, but assigns it from `v_service.scheduled_time` which is a `text` column. This will cause runtime errors if `scheduled_time` contains values that cannot be cast to `time` type (e.g., 'morning', 'afternoon', or malformed strings).

**Impact:** Reschedule operations will fail unexpectedly for some services, causing data integrity issues.

## Findings

**Location:** `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

Line 26 declares:
```sql
v_old_time time;
```

Line 46 assigns from text column:
```sql
SELECT id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status
INTO v_service
FROM public.services
-- scheduled_time is text, not time!
```

Line 54 assigns:
```sql
v_old_time := v_service.scheduled_time;  -- Implicit cast text -> time can fail
```

Lines 107, 110 then cast back to text:
```sql
v_old_time::text,   -- Unnecessary if already text
p_new_time::text,
```

**Database schema confirms:**
```typescript
// database.generated.ts line 710
scheduled_time: string | null  // text column
```

## Proposed Solutions

### Option A: Change Variable Type to Text (Recommended)

```sql
DECLARE
  v_old_time text;  -- Was: time
```

And remove the `::text` casts on lines 107 and 110.

**Pros:** Matches actual data type, no casts needed
**Cons:** None
**Effort:** Tiny
**Risk:** Low

### Option B: Add Explicit Validation

Keep `time` type but validate before cast:
```sql
IF v_service.scheduled_time IS NOT NULL AND
   v_service.scheduled_time ~ '^\d{2}:\d{2}(:\d{2})?$' THEN
  v_old_time := v_service.scheduled_time::time;
ELSE
  v_old_time := NULL;
END IF;
```

**Pros:** More explicit handling
**Cons:** Over-engineered for this use case
**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

**Verification Query:**
```sql
-- Check for non-time-compatible values in scheduled_time
SELECT DISTINCT scheduled_time
FROM services
WHERE scheduled_time IS NOT NULL
  AND scheduled_time !~ '^\d{2}:\d{2}(:\d{2})?$';
```

## Acceptance Criteria

- [ ] `v_old_time` declared as `text` type
- [ ] `::text` casts removed from lines 107 and 110
- [ ] Migration tested with services that have text time slots
- [ ] No runtime errors when rescheduling services

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Data migration expert found type mismatch |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
