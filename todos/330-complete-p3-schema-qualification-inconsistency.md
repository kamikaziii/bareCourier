---
status: complete
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

### 2026-02-13 - Closed after verification
**By:** Claude Code (verification pass)
**Reason:** The `public.` prefix in newer migrations is INTENTIONAL — they use `SET search_path = ''` for SECURITY DEFINER functions, which REQUIRES explicit schema qualification. Older migrations without this security hardening use unqualified names. This is correct security practice, not inconsistency.

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
