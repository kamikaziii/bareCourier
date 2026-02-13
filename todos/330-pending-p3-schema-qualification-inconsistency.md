---
status: pending
priority: p3
issue_id: "330"
tags: [database, naming, code-review]
dependencies: []
---

# Schema qualification inconsistency — some use public. prefix, others don't

## Problem Statement

Some migrations qualify table names with `public.` prefix (e.g., `public.profiles`) while others use unqualified names. Should be consistent for clarity, especially given search_path security concerns.

## Proposed Solutions

### Option 1: Standardize to always use public. prefix in migrations
- **Effort**: Small (for future migrations) | **Risk**: Low

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
