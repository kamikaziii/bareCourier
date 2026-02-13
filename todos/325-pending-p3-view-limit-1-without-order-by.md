---
status: pending
priority: p3
issue_id: "325"
tags: [database, determinism, code-review]
dependencies: []
---

# courier_public_profile view uses LIMIT 1 without ORDER BY

## Problem Statement

The `courier_public_profile` view selects from profiles with `WHERE role = 'courier' LIMIT 1` but no `ORDER BY`. While there's currently only one courier, this is non-deterministic SQL — the database can return any row if multiple couriers exist.

## Findings

- View in migration 000005
- Single-courier assumption baked into the view
- No ORDER BY means undefined behavior with multiple couriers

**Location:** `supabase/migrations/20260213000005_restrict_courier_profile_select.sql`

## Proposed Solutions

### Option 1: Add ORDER BY created_at ASC LIMIT 1
- **Effort**: Small | **Risk**: Low

## Acceptance Criteria
- [ ] View is deterministic

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
