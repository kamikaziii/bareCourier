---
status: complete
priority: p2
issue_id: "202"
tags: [code-review, pr-scope, pr-10]
dependencies: []
---

# 862 Lines of Unrelated Documentation Bundled in PR

## Problem Statement

PR #10 is titled "Portuguese locale formatting for numbers and route fallback handling" but includes 862 lines of documentation about Svelte 5 form patterns that are unrelated to the stated scope.

This creates confusion for reviewers and inflates the apparent scope of the PR.

## Findings

**Reviewers:** dhh-rails-reviewer, code-simplicity-reviewer

**Unrelated documentation added:**
| File | Lines | Topic |
|------|-------|-------|
| `docs/solutions/best-practices/svelte5-sveltekit-form-state-pattern-20260131.md` | 470 | Form state sync |
| `docs/solutions/patterns/svelte-sveltekit-critical-patterns.md` | 151 | Critical patterns |
| `docs/solutions/ui-bugs/svelte5-form-flash-bind-derived-20260131.md` | 227 | Form flash bug |
| `docs/solutions/ui-bugs/svelte5-form-state-sync-after-submission.md` | 14 | State sync |

The project already has `.claude/rules/svelte-form-state.md` covering these patterns.

## Proposed Solutions

### Option A: Split Into Separate PR (Recommended)

Move all `docs/solutions/` files to a separate PR about Svelte 5 form patterns.

- **Pros:** Focused PR scope, easier review
- **Cons:** Extra PR to manage
- **Effort:** Small (15 mins)
- **Risk:** None

### Option B: Remove Redundant Docs

If `.claude/rules/svelte-form-state.md` already covers these patterns, remove the duplicates.

- **Pros:** Cleaner codebase
- **Cons:** May lose some detail
- **Effort:** Small (review content, delete)
- **Risk:** Low

## Technical Details

**Files to remove/move:**
- `docs/solutions/best-practices/svelte5-sveltekit-form-state-pattern-20260131.md`
- `docs/solutions/patterns/svelte-sveltekit-critical-patterns.md`
- `docs/solutions/ui-bugs/svelte5-form-flash-bind-derived-20260131.md`
- `docs/solutions/ui-bugs/svelte5-form-state-sync-after-submission.md`

## Acceptance Criteria

- [ ] PR #10 contains only formatting and route fallback changes
- [ ] Documentation is either in separate PR or consolidated with existing rules

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
