---
status: complete
priority: p2
issue_id: "200"
tags: [code-review, security, database, pr-10]
dependencies: []
---

# Migration search_path Setting Inconsistent with Codebase

## Problem Statement

The migration `20260131160000_fix_display_id_race_condition.sql` uses `SET search_path = public` while other SECURITY DEFINER functions in the codebase use `SET search_path = ''` (empty string).

An empty search_path is the PostgreSQL security best practice for SECURITY DEFINER functions to prevent schema poisoning attacks.

## Findings

**Reviewers:** security-sentinel

**Current implementation:**
```sql
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
```

**Other functions use empty string:**
- `20260121000006_fix_is_courier_search_path.sql`
- `20260121000018_fix_pricing_function_search_paths.sql`

## Proposed Solutions

### Option A: Change to Empty search_path (Recommended)

```sql
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
```

Then use fully qualified table names:
```sql
SELECT last_number INTO next_number
FROM public.service_counters
WHERE year = current_year
FOR UPDATE;
```

- **Pros:** Aligns with codebase security patterns
- **Cons:** Need to fully qualify table references
- **Effort:** Small (15 mins)
- **Risk:** Low

## Technical Details

**File to modify:**
- `supabase/migrations/20260131160000_fix_display_id_race_condition.sql`

## Acceptance Criteria

- [ ] Function uses `SET search_path = ''`
- [ ] All table references are fully qualified (e.g., `public.service_counters`)
- [ ] Consistent with other SECURITY DEFINER functions in codebase

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
