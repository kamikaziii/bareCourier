---
status: ready
priority: p2
issue_id: "164"
tags: [code-review, database, data-integrity, pr-5]
dependencies: []
---

# Missing Time Range CHECK Constraints in Migrations

## Problem Statement

The new database tables `break_logs` and `delivery_time_logs` lack CHECK constraints to enforce that end times are after start times. This allows insertion of logically invalid records with negative durations, which could corrupt workload calculations and learning algorithms.

## Findings

**Location:** `supabase/migrations/20260129000001_add_workload_management_tables.sql`

1. **break_logs table (lines 8-9):**
   ```sql
   started_at TIMESTAMPTZ NOT NULL,
   ended_at TIMESTAMPTZ,
   ```
   No constraint ensures `ended_at > started_at` when `ended_at` is not null.

2. **delivery_time_logs table (lines 21-24):**
   ```sql
   started_at TIMESTAMPTZ NOT NULL,
   completed_at TIMESTAMPTZ NOT NULL,
   ```
   No constraint ensures `completed_at > started_at`.

**Risk:** `getBreakTimeForRange()` in `breaks.ts:142-146` will calculate negative durations if `ended_at < started_at`, corrupting workload estimates.

## Proposed Solutions

### Option A: Add CHECK Constraints to Migration (Recommended)
Add database-level constraints to enforce validity.

```sql
-- For break_logs
CONSTRAINT valid_break_time_range CHECK (ended_at IS NULL OR ended_at > started_at)

-- For delivery_time_logs
CONSTRAINT valid_time_range CHECK (completed_at > started_at)
```

**Pros:** Database enforced, impossible to bypass, single source of truth
**Cons:** Requires new migration file
**Effort:** Small
**Risk:** Low

### Option B: Add Application-Level Validation
Validate in `logRetroactiveBreak()` and service functions.

**Pros:** Faster to implement
**Cons:** Can be bypassed by direct database access, duplicates validation logic
**Effort:** Small
**Risk:** Medium (less reliable)

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected files:**
- `supabase/migrations/20260129000001_add_workload_management_tables.sql`

**New migration needed:**
```sql
-- supabase/migrations/20260129000003_add_time_range_constraints.sql
ALTER TABLE break_logs
  ADD CONSTRAINT valid_break_time_range
  CHECK (ended_at IS NULL OR ended_at > started_at);

ALTER TABLE delivery_time_logs
  ADD CONSTRAINT valid_time_range
  CHECK (completed_at > started_at);
```

## Acceptance Criteria

- [ ] New migration file created with CHECK constraints
- [ ] Migration applies successfully to existing data
- [ ] Attempting to insert `ended_at < started_at` fails with constraint error
- [ ] `supabase db push` succeeds

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (data-integrity-guardian)

**Actions:**
- Identified missing constraints during PR #5 review
- Verified no existing validation prevents invalid data

**Learnings:**
- Time range validation should be at database level for data integrity

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
- Migration file: `supabase/migrations/20260129000001_add_workload_management_tables.sql`
