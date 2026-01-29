---
status: ready
priority: p2
issue_id: "165"
tags: [code-review, database, race-condition, pr-5]
dependencies: []
---

# Race Condition in Break Toggle Operations

## Problem Statement

The `startBreak()` function in `breaks.ts` has a check-then-act race condition. Two simultaneous calls could both pass the "not on break" check before either inserts, resulting in two concurrent active breaks for the same courier.

## Findings

**Location:** `src/lib/services/breaks.ts` (lines 47-71)

```typescript
export async function startBreak(...) {
  // Check if already on break
  const current = await getCurrentBreak(supabase, courierId);  // READ
  if (current) {
    return { success: false, error: 'Already on break' };
  }

  const { error } = await supabase.from('break_logs').insert({  // WRITE
    courier_id: courierId,
    started_at: new Date().toISOString(),
    type,
    source
  });
}
```

**Race scenario:**
1. Request A reads: no active break
2. Request B reads: no active break
3. Request A inserts break
4. Request B inserts break
5. Result: Two concurrent breaks for the same courier

**Severity:** Low for single-courier app, but architecturally incorrect.

## Proposed Solutions

### Option A: Unique Partial Index (Recommended)
Add database-level constraint preventing multiple active breaks.

```sql
CREATE UNIQUE INDEX idx_break_logs_active_break
  ON break_logs (courier_id)
  WHERE ended_at IS NULL;
```

**Pros:** Database enforced atomically, handles all edge cases, also speeds up `getCurrentBreak()` queries
**Cons:** Requires migration
**Effort:** Small
**Risk:** Low

### Option B: Database Transaction with Locking
Use `SELECT ... FOR UPDATE` pattern.

**Pros:** Standard database concurrency pattern
**Cons:** More complex, Supabase client doesn't easily support transactions
**Effort:** Medium
**Risk:** Medium

### Option C: Application-Level Debouncing
Prevent rapid consecutive calls in UI.

**Pros:** Simple to implement
**Cons:** Doesn't fix the actual race condition, only reduces probability
**Effort:** Small
**Risk:** High (race still possible)

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected files:**
- `src/lib/services/breaks.ts`
- `supabase/migrations/` (new file needed)

**Migration for Option A:**
```sql
-- supabase/migrations/20260129000004_add_unique_active_break_index.sql
CREATE UNIQUE INDEX idx_break_logs_active_break
  ON break_logs (courier_id)
  WHERE ended_at IS NULL;
```

## Acceptance Criteria

- [ ] Only one active break per courier can exist at any time
- [ ] Attempting to start a second break fails cleanly
- [ ] `startBreak()` returns appropriate error when constraint violated

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agents (data-integrity-guardian, security-sentinel)

**Actions:**
- Identified check-then-act pattern during PR #5 review
- Analyzed race condition scenario

**Learnings:**
- Database constraints are more reliable than application checks for concurrency

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
- breaks.ts: `src/lib/services/breaks.ts:47-71`
