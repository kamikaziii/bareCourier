---
status: complete
priority: p3
issue_id: "327"
tags: [database, naming, code-review]
dependencies: []
---

# Variable naming inconsistency in trigger functions

## Problem Statement

Trigger functions use inconsistent variable naming: `_role` in some, `user_role` in others, `v_user_role` in yet others. Should follow a consistent convention.

## Proposed Solutions

### Option 1: Standardize to v_ prefix convention
- **Effort**: Small | **Risk**: Low

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
