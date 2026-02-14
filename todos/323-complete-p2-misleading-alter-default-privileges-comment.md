---
status: complete
priority: p2
issue_id: "323"
tags: [database, documentation, code-review]
dependencies: []
---

# Misleading ALTER DEFAULT PRIVILEGES comment in migration 000011

## Problem Statement

Migration 000011 contains `ALTER DEFAULT PRIVILEGES` statements with comments suggesting they affect existing objects, but `ALTER DEFAULT PRIVILEGES` only affects FUTURE objects created by the specified role. The comment is misleading and could cause confusion about what's actually protected.

## Findings

- `ALTER DEFAULT PRIVILEGES` only affects future objects
- Comment implies it covers existing functions
- Actual REVOKE statements (which DO affect existing objects) are also present, so the security effect is correct — but the comment is wrong

**Location:** `supabase/migrations/20260213000011_revoke_anon_from_new_rpcs.sql`

## Proposed Solutions

### Option 1: Fix the comment (Recommended)
Update comment to clarify that `ALTER DEFAULT PRIVILEGES` is for future functions.
- **Pros**: Accurate documentation
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Acceptance Criteria
- [ ] Comment accurately describes what ALTER DEFAULT PRIVILEGES does

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Identified by security-sentinel agent

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
