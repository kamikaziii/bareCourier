---
status: complete
priority: p3
issue_id: "206"
tags: [code-review, database, edge-case, pr-10]
dependencies: []
---

# Year Boundary Edge Case in display_id Generation

## Problem Statement

The trigger uses `CURRENT_DATE` for year extraction instead of the service's `created_at` timestamp. At midnight on New Year's Eve, a service could get a display_id for the wrong year.

## Findings

**Reviewers:** data-integrity-guardian

**Current implementation:**
```sql
current_year := (EXTRACT(YEAR FROM CURRENT_DATE)::integer % 100)::smallint;
```

**Scenario:**
- Service created at 2026-12-31 23:59:59
- Trigger runs at 2027-01-01 00:00:01
- display_id would be `#27-0001` but `created_at` shows 2026

## Proposed Solutions

### Option A: Use Service's created_at (If Available)

```sql
current_year := (EXTRACT(YEAR FROM COALESCE(NEW.created_at, CURRENT_TIMESTAMP))::integer % 100)::smallint;
```

- **Pros:** Consistent with service's actual creation date
- **Cons:** Complexity if services have future created_at dates
- **Effort:** Small (10 mins)
- **Risk:** Low

### Option B: Accept Current Behavior

Document that display_id reflects trigger execution time, not service creation time.

- **Pros:** No code change
- **Cons:** Edge case still exists
- **Effort:** None
- **Risk:** Low (rare scenario)

## Technical Details

**File to modify:**
- `supabase/migrations/20260131160000_fix_display_id_race_condition.sql`

**Frequency:** Would only affect services created within seconds of midnight on New Year's Eve.

## Acceptance Criteria

- [ ] Either fix the edge case or document the expected behavior
- [ ] No confusing display IDs for year-boundary services

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
