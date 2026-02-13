---
status: pending
priority: p3
issue_id: 322
tags: [code-review, simplicity, pr-20]
dependencies: []
---

# Simplify: Remove Server-Side Pagination (YAGNI)

## Problem Statement

The address book page implements server-side pagination with `PAGE_SIZE = 20`. For a personal address book, a single client will realistically have 5-15 saved addresses. Pagination adds ~35 LOC of unnecessary complexity (URL params, page state, pagination UI).

## Findings

**Flagged by:** Code Simplicity Reviewer (highest impact)

**Files:** `src/routes/client/address-book/+page.server.ts`, `src/routes/client/address-book/+page.svelte`

Lines to remove: `PAGE_SIZE`, `page`/`offset` parsing, `.range()`, `count: 'exact'`, `totalPages` derived, `goToPage()`, pagination UI block (~lines 208-231).

## Proposed Solution

Remove pagination. Load all addresses per client in one query:
```typescript
const { data: addresses } = await query;
return { addresses: addresses ?? [], search };
```

If a client someday has 100+ addresses, add it back then.

- **Effort:** Small (~35 LOC removal)
- **Risk:** None

## Acceptance Criteria

- [ ] No pagination UI on address book page
- [ ] All addresses load in single query

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | |

## Resources

- [PR #20](https://github.com/kamikaziii/bareCourier/pull/20)
