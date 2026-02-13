---
status: pending
priority: p3
issue_id: "324"
tags: [database, idempotency, code-review]
dependencies: []
---

# Migration 000006 missing DROP TRIGGER IF EXISTS before CREATE

## Problem Statement

Migration 000006 creates a notification update trigger without first dropping it if it exists. This makes the migration non-idempotent — running it twice would fail.

## Findings

- No `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER` in 000006
- Other migrations (000003, 000004) correctly use DROP before CREATE
- Inconsistency in trigger creation pattern

**Location:** `supabase/migrations/20260213000006_add_notification_update_trigger.sql`

## Proposed Solutions

### Option 1: Add DROP TRIGGER IF EXISTS
- **Effort**: Small | **Risk**: Low

## Acceptance Criteria
- [ ] Migration is idempotent

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
