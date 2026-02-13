---
status: pending
priority: p2
issue_id: 319
tags: [code-review, data-integrity, pr-20]
dependencies: []
---

# Migration: Add Unique Constraint on (client_id, label)

## Problem Statement

A client can save multiple addresses with the same label (e.g., two "Office" entries). This creates confusion in the AddressBookPicker dropdown where identical labels are indistinguishable.

## Findings

**Flagged by:** Data Integrity Guardian (MEDIUM), Architecture Strategist (should fix)

## Proposed Solution

Add to migration:
```sql
CREATE UNIQUE INDEX idx_client_addresses_unique_label
  ON client_addresses(client_id, lower(label));
```

Using `lower(label)` prevents case-only duplicates ("Office" vs "office").

Handle constraint violation in server action (catch error code `23505`):
```typescript
if (error?.code === '23505') {
    return fail(400, { error: 'A saved address with this label already exists' });
}
```

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Duplicate labels for same client rejected at DB level
- [ ] Server action returns user-friendly error on duplicate
- [ ] Case-insensitive (e.g., "Office" and "office" are duplicates)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | |

## Resources

- [PR #20](https://github.com/kamikaziii/bareCourier/pull/20)
