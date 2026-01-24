# Fix Inconsistent Search Paths in Migration Functions

---
status: ready
priority: p3
issue_id: "013"
tags: [code-review, security, database]
dependencies: []
plan_task: "N/A"
plan_status: "PREREQUISITE - Fix before new migrations"
---

> **UX PLAN INTEGRATION**: This is a **PREREQUISITE** for the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). Fix inconsistent search paths **before** applying new migrations (018, 019) to maintain consistency across all database functions.

## Problem Statement

Two SECURITY DEFINER functions use `SET search_path = public` instead of the recommended `SET search_path = ''` (empty string).

**Why it matters**: Inconsistency with other functions; slightly less secure pattern.

## Findings

- **Location**:
  - `supabase/migrations/014_create_client_pricing.sql` (line 70)
  - `supabase/migrations/017_add_service_pricing_fields.sql` (line 24)
- **Agent**: data-migration-expert

**Affected Functions**:
- `update_client_pricing_updated_at()`
- `calculate_service_price()`

## Proposed Solutions

### Option 1: Create Fix Migration (Recommended)
```sql
-- 018_fix_pricing_function_search_paths.sql

CREATE OR REPLACE FUNCTION update_client_pricing_updated_at()
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

-- Also fix calculate_service_price with SET search_path = ''
```

**Effort**: Low
**Risk**: Low

## Acceptance Criteria

- [ ] Both functions have `SET search_path = ''`
- [ ] Functions still work correctly
- [ ] Migration applied successfully

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by data-migration-expert | Consistency matters for maintainability |
| 2026-01-22 | Approved during triage | Ready for implementation - create migration to fix both functions |

## Resources

- PostgreSQL SECURITY DEFINER: https://www.postgresql.org/docs/current/sql-createfunction.html
- Supabase Migrations: https://supabase.com/docs/guides/migrations/overview
