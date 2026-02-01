---
status: complete
priority: p3
issue_id: "205"
tags: [code-review, database, migration, pr-10]
dependencies: []
---

# Migration Uses DROP TRIGGER Pattern That May Cause Issues

## Problem Statement

The migration uses `DROP TRIGGER IF EXISTS` followed by `CREATE TRIGGER` instead of just `CREATE OR REPLACE FUNCTION`. During the window between DROP and CREATE, any concurrent INSERT will not have a trigger attached.

## Findings

**Reviewers:** data-migration-expert

**Current pattern:**
```sql
DROP TRIGGER IF EXISTS services_before_insert_display_id ON services;
-- ... function definition ...
CREATE TRIGGER services_before_insert_display_id ...
```

**Risk:** Services created during deployment may get NULL display_id, violating the NOT NULL constraint.

## Proposed Solutions

### Option A: Use CREATE OR REPLACE Only (Recommended)

```sql
CREATE OR REPLACE FUNCTION generate_service_display_id()
RETURNS TRIGGER AS $$
  -- ... implementation
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The existing trigger automatically uses the updated function
-- No DROP/CREATE TRIGGER needed
```

- **Pros:** No gap during deployment
- **Cons:** None
- **Effort:** Trivial (remove DROP/CREATE TRIGGER lines)
- **Risk:** None

## Technical Details

**File to modify:**
- `supabase/migrations/20260131160000_fix_display_id_race_condition.sql`

## Acceptance Criteria

- [ ] Migration only uses CREATE OR REPLACE FUNCTION
- [ ] No DROP TRIGGER statement
- [ ] Trigger definition unchanged (already correct from original migration)

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
