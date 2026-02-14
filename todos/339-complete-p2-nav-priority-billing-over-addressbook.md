---
status: pending
priority: p2
issue_id: 339
tags: [code-review, architecture, ux, pr-20]
dependencies: []
---

# Navigation: Keep Billing in Bottom Nav, Move Address Book to Overflow

## Problem Statement

The PR places Address Book as the 4th bottom nav item, pushing Billing into the "More" overflow menu. Billing is used weekly/monthly (financial oversight), while Address Book is a setup-and-forget feature accessed primarily through the inline picker.

## Findings

**File:** `src/routes/client/+layout.svelte`

**Flagged by:** Architecture Strategist (must fix)

Usage frequency hierarchy:
1. My Services -- daily
2. New Request -- daily
3. Calendar -- weekly
4. **Billing** -- weekly/monthly
5. **Address Book** -- occasional (setup)
6. Settings -- rare

## Proposed Solution

Keep Billing in position 4, place Address Book in position 5 (overflow):

```typescript
const allNavItems: NavItem[] = $derived([
    { href: '/client', label: m.nav_my_services(), icon: Package, badge: data.navCounts?.suggestedServices },
    { href: '/client/new', label: m.nav_new_request(), icon: PlusCircle },
    { href: '/client/calendar', label: m.nav_calendar(), icon: Calendar },
    { href: '/client/billing', label: m.nav_billing(), icon: Receipt },
    { href: '/client/address-book', label: m.nav_address_book(), icon: BookUser },
    { href: '/client/settings', label: m.nav_settings(), icon: Settings }
]);
```

- **Effort:** Trivial (reorder array items)
- **Risk:** None

## Acceptance Criteria

- [ ] Billing remains in bottom nav bar (position 4)
- [ ] Address Book accessible via sidebar (desktop) and "More" menu (mobile)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | |

## Resources

- [PR #20](https://github.com/kamikaziii/bareCourier/pull/20)
