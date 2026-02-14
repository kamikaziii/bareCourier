---
status: complete
priority: p3
issue_id: "332"
tags: [security, database, code-review]
dependencies: []
---

# No explicit REVOKE on courier_public_profile view from anon

## Problem Statement

The `courier_public_profile` view (migration 000005) grants SELECT to authenticated but doesn't explicitly REVOKE from anon. While Supabase likely doesn't grant anon access by default for new views, an explicit REVOKE is defense-in-depth best practice.

## Proposed Solutions

### Option 1: Add REVOKE SELECT ON courier_public_profile FROM anon
- **Effort**: Small | **Risk**: Low

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
