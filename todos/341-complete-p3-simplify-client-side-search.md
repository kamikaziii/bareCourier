---
status: pending
priority: p3
issue_id: 341
tags: [code-review, simplicity, pr-20]
dependencies: [340]
---

# Simplify: Use Client-Side Search Instead of Server-Side

## Problem Statement

The address book page does server-side search via URL params with 300ms debounce and `goto()` navigation. With small address lists per client, client-side filtering (like the AddressBookPicker already does) is simpler and eliminates network round-trips.

## Findings

**Flagged by:** Code Simplicity Reviewer (high impact)

**Note:** This naturally pairs with removing pagination (todo 340). Without pagination, all addresses are already loaded client-side, so server-side search becomes pointless.

Also **resolves todo 334** (PostgREST filter injection) since the `.or()` interpolation is removed entirely.

## Proposed Solution

Replace server-side search + debounce with a simple `$derived` filter:
```typescript
let searchTerm = $state("");
const filtered = $derived(
    searchTerm
        ? data.addresses.filter(a =>
            a.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.address.toLowerCase().includes(searchTerm.toLowerCase()))
        : data.addresses
);
```

Remove: `searchTimeout`, `handleSearchInput`, debounce logic, URL manipulation, `search` from server load.

- **Effort:** Small (~20 LOC net reduction)
- **Risk:** None

## Acceptance Criteria

- [ ] Search works client-side with instant filtering
- [ ] No URL params for search
- [ ] No debounce timer needed
- [ ] PostgREST `.or()` interpolation removed from server

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | |

## Resources

- [PR #20](https://github.com/kamikaziii/bareCourier/pull/20)
