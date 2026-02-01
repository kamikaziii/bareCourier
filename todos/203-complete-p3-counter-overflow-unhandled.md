---
status: complete
priority: p3
issue_id: "203"
tags: [code-review, database, pr-10]
dependencies: []
---

# Display ID Counter Overflow Unhandled

## Problem Statement

The display_id format `#YY-NNNN` supports only 9999 services per year. No overflow protection exists.

Service #10000 would produce `#26-10000` (5 digits), breaking the expected format and potentially causing issues with parsing/validation code.

## Findings

**Reviewers:** data-integrity-guardian

**Current format:**
```sql
NEW.display_id := '#' || lpad(current_year::text, 2, '0') || '-' || lpad(next_number::text, 4, '0');
```

**Impact:**
- Display inconsistency in UI
- Potential parsing issues if code expects exactly 4 digits
- 9999/year = ~27 services/day (likely sufficient for solo courier)

## Proposed Solutions

### Option A: Add Overflow Protection (Recommended)

```sql
IF next_number > 9999 THEN
  RAISE EXCEPTION 'Service counter overflow for year %. Maximum 9999 services per year.', current_year;
END IF;
```

- **Pros:** Fails fast with clear error
- **Cons:** Would need manual resolution if hit
- **Effort:** Trivial (5 mins)
- **Risk:** None

### Option B: Expand Format to 5 Digits

```sql
NEW.display_id := '#' || lpad(current_year::text, 2, '0') || '-' || lpad(next_number::text, 5, '0');
```

- **Pros:** Future-proof (99,999 services/year)
- **Cons:** Requires data migration for existing records
- **Effort:** Medium (1 hour)
- **Risk:** Low

### Option C: Add Monitoring Alert

Alert when counter reaches 9000 to warn before limit.

- **Pros:** Proactive warning
- **Cons:** Doesn't prevent the issue
- **Effort:** Small
- **Risk:** None

## Technical Details

**File to modify:**
- `supabase/migrations/20260131160000_fix_display_id_race_condition.sql`

## Acceptance Criteria

- [ ] Counter overflow is either prevented or handled gracefully
- [ ] System doesn't silently produce malformed display IDs

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
