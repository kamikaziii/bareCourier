---
status: ready
priority: p2
issue_id: "247"
tags: [code-review, input-validation, database, pr-13]
dependencies: []
---

# Time Slot Validation Not Enforced in RPC

## Problem Statement

The `reschedule_service` RPC function accepts any text value for `p_new_time_slot` without validating it against the allowed values. While the database has a CHECK constraint, invalid values cause generic errors instead of user-friendly messages.

## Findings

**Source:** security-sentinel agent

**Location:** `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

**Current code:**
```sql
CREATE OR REPLACE FUNCTION reschedule_service(
  p_service_id uuid,
  p_new_date date,
  p_new_time_slot text,  -- No validation!
  p_new_time text DEFAULT NULL,
  ...
)
```

**Impact:**
- Invalid values cause confusing database errors
- Allows probing for valid values
- Inconsistent with frontend validation

## Proposed Solutions

### Solution 1: Add Explicit Validation (Recommended)
**Pros:** Clear error messages, defense in depth
**Cons:** Slight code increase
**Effort:** Small
**Risk:** Low

```sql
IF p_new_time_slot NOT IN ('morning', 'afternoon', 'evening', 'specific') THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Invalid time slot. Must be: morning, afternoon, evening, or specific'
  );
END IF;
```

### Solution 2: Create ENUM Type
**Pros:** Database-level enforcement
**Cons:** Requires migration for changes
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

**Valid Time Slots:**
- `morning`
- `afternoon`
- `evening`
- `specific`

## Acceptance Criteria

- [ ] Invalid time slots return user-friendly error
- [ ] Valid time slots work as expected
- [ ] Error message indicates valid options

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Input validation gap |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
