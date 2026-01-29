---
status: complete
priority: p3
issue_id: "188"
tags: [code-review, database, pr-7]
dependencies: []
---

# Missing Unique Constraint on Service Type Name

## Problem Statement

The `service_types` table allows duplicate names, which could cause UI confusion when two service types have identical names (e.g., two "Dental" entries with different prices).

## Findings

**Source:** Data Integrity Guardian Agent

**Location:** `supabase/migrations/20260129130000_add_service_types_table.sql`

**Current Schema:**
```sql
CREATE TABLE service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,  -- No uniqueness constraint
  price numeric(10,2) NOT NULL,
  ...
);
```

**Impact:**
- Duplicate names allowed
- UI confusion in dropdowns
- Potential data quality issues

## Proposed Solutions

### Solution 1: Add partial unique index (Recommended)
```sql
CREATE UNIQUE INDEX idx_service_types_name_unique
  ON service_types(name) WHERE active = true;
```
- **Pros:** Prevents duplicates among active types
- **Cons:** Allows reactivation of deactivated types with same name
- **Effort:** Small
- **Risk:** Low

### Solution 2: Add simple unique constraint
```sql
ALTER TABLE service_types ADD CONSTRAINT service_types_name_unique UNIQUE (name);
```
- **Pros:** Simple
- **Cons:** Can't have inactive types with same name
- **Effort:** Small
- **Risk:** Low

## Technical Details

**Affected Files:**
- New migration file

## Acceptance Criteria

- [ ] Cannot create two active service types with same name
- [ ] Clear error message when duplicate attempted

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by data-integrity-guardian agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
