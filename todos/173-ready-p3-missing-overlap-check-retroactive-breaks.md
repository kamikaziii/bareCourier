---
status: ready
priority: p3
issue_id: "173"
tags: [code-review, data-integrity, pr-5]
dependencies: []
---

# Missing Overlap Check in logRetroactiveBreak

## Problem Statement

The `logRetroactiveBreak()` function does not check for overlapping breaks before inserting. A retroactive break could overlap with an existing break, causing `getBreakTimeForRange()` to double-count time.

## Findings

**Location:** `src/lib/services/breaks.ts` (lines 101-121)

```typescript
export async function logRetroactiveBreak(
  supabase: SupabaseClient,
  courierId: string,
  startedAt: Date,
  endedAt: Date,
  source: 'anomaly_prompt' | 'daily_review'
): Promise<{ success: boolean; error?: string }> {
  // No overlap check!
  const { error } = await supabase.from('break_logs').insert({
    courier_id: courierId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    type: 'retroactive',
    source
  });
  // ...
}
```

**Example corruption scenario:**
1. Existing break: 12:00-13:00 (60 minutes)
2. Retroactive break logged: 12:30-14:00 (90 minutes)
3. `getBreakTimeForRange` counts: 60 + 90 = 150 minutes
4. Actual break time: 120 minutes (12:00-14:00)

**Note:** This function is currently unused (YAGNI issue #170), but if kept, needs this fix.

## Proposed Solutions

### Option A: Database EXCLUDE Constraint (Recommended)

PostgreSQL's `EXCLUDE` constraint with `tstzrange` is the **gold standard** for preventing overlapping time ranges. This is the approach recommended by PostgreSQL documentation and database best practices.

```sql
-- Requires btree_gist extension (one-time setup)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint
ALTER TABLE break_logs
  ADD CONSTRAINT no_overlapping_breaks
  EXCLUDE USING GIST (
    courier_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'), '[)') WITH &&
  );
```

**Why this is the best solution:**
- **Database enforced** - Impossible to bypass from any code path
- **Atomic** - No race conditions (unlike application-level checks)
- **Handles edge cases** - NULL `ended_at` (active breaks) handled with COALESCE
- **Self-documenting** - Constraint name explains the business rule
- **Uses `[)` bounds** - Closed-open intervals are the PostgreSQL convention

**Pros:** Database enforced, atomic, handles all edge cases correctly
**Cons:** Requires btree_gist extension (standard, safe to install)
**Effort:** Small (one migration file)
**Risk:** Low

### Option B: Application-Level Overlap Detection

Fallback if database constraint is not feasible.

```typescript
// Check for overlapping breaks
const { data: existing } = await supabase
  .from('break_logs')
  .select('id')
  .eq('courier_id', courierId)
  .or(`and(started_at.lte.${endedAt.toISOString()},ended_at.gte.${startedAt.toISOString()})`)
  .limit(1);

if (existing && existing.length > 0) {
  return { success: false, error: 'Break overlaps with existing break' };
}
```

**Pros:** No database migration needed
**Cons:** Race condition possible, extra query, can be bypassed by direct DB access
**Effort:** Medium
**Risk:** Medium (race conditions)

### Option C: Remove Function (If YAGNI applies)

Delete `logRetroactiveBreak()` per YAGNI issue #170.

**Pros:** No code, no bugs
**Cons:** Need to re-implement later if retroactive breaks are needed
**Effort:** Small
**Risk:** Low

## Recommended Action

**Option A (Database EXCLUDE Constraint)** - This is the PostgreSQL-recommended approach for time range overlap prevention. The `btree_gist` extension is safe and commonly used.

## Technical Details

**Affected files:**
- `supabase/migrations/` (new migration file)
- `src/lib/services/breaks.ts` (error handling for constraint violation)

**Migration file:**
```sql
-- supabase/migrations/20260129000006_add_break_overlap_constraint.sql

-- Enable btree_gist extension for EXCLUDE constraints with scalar types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping breaks per courier
-- Uses [) bounds (closed-open) which is PostgreSQL convention
-- COALESCE handles active breaks (ended_at IS NULL) by treating them as infinite
ALTER TABLE break_logs
  ADD CONSTRAINT no_overlapping_breaks
  EXCLUDE USING GIST (
    courier_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'), '[)') WITH &&
  );
```

## Acceptance Criteria

- [ ] btree_gist extension enabled
- [ ] EXCLUDE constraint added to break_logs table
- [ ] Overlapping breaks cannot be created (database rejects with constraint error)
- [ ] Application handles constraint violation with clear error message
- [ ] Migration applies successfully to existing data (verify no overlaps exist)

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (data-integrity-guardian)

**Actions:**
- Identified missing overlap check during PR #5 review
- Analyzed potential data corruption scenario

**Learnings:**
- Time range operations need overlap checking

### 2026-01-29 - Best Practices Research

**By:** Research validation

**Actions:**
- Researched PostgreSQL best practices for time range overlap prevention
- Confirmed EXCLUDE constraint with tstzrange is the gold standard approach
- Updated recommendation from application-level check to database constraint

**Learnings:**
- PostgreSQL EXCLUDE constraints are atomic and race-condition free
- `[)` (closed-open) bounds are the standard convention
- btree_gist extension is safe and commonly used for combining scalar + range constraints

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
- PostgreSQL exclusion constraints: https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-EXCLUDE
- PostgreSQL range types: https://www.postgresql.org/docs/current/rangetypes.html
- Non-overlapping time ranges pattern: https://sqlfordevs.com/non-overlapping-time-ranges
