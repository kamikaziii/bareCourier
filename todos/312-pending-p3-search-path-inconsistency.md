---
status: pending
priority: p3
issue_id: "312"
tags: [security, supabase, consistency, search-path]
dependencies: []
---

# search_path Inconsistency in 2 SECURITY DEFINER Functions

## Problem Statement

Two SECURITY DEFINER functions use `SET search_path = public` instead of the more secure `SET search_path = ''`. All other SECURITY DEFINER functions in the codebase use `search_path = ''`. Low practical risk in Supabase's managed environment, but inconsistent with the established security pattern.

## Findings

- Function `update_service_types_updated_at()` in migration `20260129130000_add_service_types_table.sql` (line 54) uses `SET search_path = public`
- Function `replace_distribution_zones()` in migration `20260129140003_fix_replace_distribution_zones_auth.sql` (line 11) uses `SET search_path = public`
- All other SECURITY DEFINER functions use `SET search_path = ''` with fully qualified table references (e.g., `public.profiles`, `public.services`)
- Using `search_path = public` instead of `search_path = ''` theoretically allows a schema-injection attack if an attacker can create objects in the `public` schema, but this is extremely unlikely in Supabase's managed environment
- The inconsistency makes security audits harder and could mislead developers into thinking `search_path = public` is acceptable

**Affected files:**
- `supabase/migrations/20260129130000_add_service_types_table.sql` line 54
- `supabase/migrations/20260129140003_fix_replace_distribution_zones_auth.sql` line 11

## Proposed Solutions

### Option 1: Rewrite Both Functions with search_path = ''

**Approach:** Create a migration that replaces both functions using `SET search_path = ''` and fully qualified table references.

```sql
CREATE OR REPLACE FUNCTION update_service_types_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

```sql
CREATE OR REPLACE FUNCTION replace_distribution_zones(...)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Use public.distribution_zones instead of distribution_zones
  DELETE FROM public.distribution_zones WHERE ...;
  INSERT INTO public.distribution_zones ...;
END;
$$;
```

**Pros:**
- Consistent with all other SECURITY DEFINER functions
- Eliminates theoretical schema-injection vector
- Clean codebase

**Cons:**
- Requires reviewing and updating all table references to be fully qualified
- Migration overhead for minimal practical impact

**Effort:** 30 minutes - 1 hour

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260129130000_add_service_types_table.sql` - update_service_types_updated_at()
- `supabase/migrations/20260129140003_fix_replace_distribution_zones_auth.sql` - replace_distribution_zones()
- New migration required

**Database changes:**
- Migration needed: Yes
- Replace both function definitions with `SET search_path = ''`
- Ensure all table references are fully qualified (`public.table_name`)

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review
- **Reference:** PostgreSQL SECURITY DEFINER best practices
- **Note:** Previous todo #200 (search-path-inconsistency) may have addressed other instances

## Acceptance Criteria

- [ ] `update_service_types_updated_at()` uses `SET search_path = ''`
- [ ] `replace_distribution_zones()` uses `SET search_path = ''`
- [ ] All table references in both functions are fully qualified
- [ ] Both functions still work correctly after migration
- [ ] No other SECURITY DEFINER functions use `search_path = public`
- [ ] Migration applied with `supabase db push`

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Audited all SECURITY DEFINER functions for search_path settings
- Identified 2 functions using `search_path = public` instead of `search_path = ''`
- Confirmed all other SECURITY DEFINER functions use the secure pattern
- Assessed practical risk as low in Supabase's managed environment

**Learnings:**
- SECURITY DEFINER functions should always use `SET search_path = ''` to prevent schema-injection
- Consistency in security patterns is important for auditability
- Previous todo #200 may have addressed similar issues -- check if these were missed
