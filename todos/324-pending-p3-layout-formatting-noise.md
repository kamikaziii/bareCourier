---
status: pending
priority: p3
issue_id: 324
tags: [code-review, quality, pr-20]
dependencies: []
---

# Separate Layout Formatting Changes from Functional Changes

## Problem Statement

`src/routes/client/+layout.svelte` diff shows ~65 lines changed, but only ~5 are functional (adding BookUser import + address-book nav item). The rest is tabs-to-spaces + single-to-double-quote reformatting that pollutes the diff and breaks `git blame`.

## Proposed Solution

Either:
- Revert formatting, keep only the functional nav item addition
- Or do the formatting in a separate commit

- **Effort:** Trivial
- **Risk:** None

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | |
