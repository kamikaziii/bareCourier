---
status: pending
priority: p3
issue_id: 336
tags: [code-review, performance, pr-20]
dependencies: []
---

# AddressBookPicker: Replace getUser() with Session-Based User ID

## Problem Statement

`AddressBookPicker.svelte` calls `supabase.auth.getUser()` on every inline save, which makes a network roundtrip to the Supabase auth endpoint (~100ms). The user ID is already available in the parent page's context.

**Note:** The original review claimed this component "breaks the project's established pattern where components are presentation-only." This is **incorrect** -- 5 existing components (`NotificationBell`, `PasswordChangeForm`, `WorkStatusBar`, `NotificationsTab`, `AppShell`) already accept `supabase` as a prop and several perform mutations directly. The architecture concern is an opinion, not a pattern violation.

The actionable issue is the unnecessary `getUser()` roundtrip.

## Findings

**File:** `src/lib/components/AddressBookPicker.svelte`, line 61

```typescript
client_id: (await supabase.auth.getUser()).data.user?.id,
```

`supabase.auth.getUser()` makes an HTTP call to verify the JWT. `supabase.auth.getSession()` reads from local memory (no network). Or better: pass the user ID as a prop from the parent, which already has it.

**Flagged by:** Performance Oracle, Security Sentinel (null check concern)

## Proposed Solutions

### Option A: Use getSession() (minimal change)
```typescript
client_id: (await supabase.auth.getSession()).data.session?.user.id,
```
- **Pros:** One-line change, no API change
- **Cons:** Still optional-chained (could be undefined if session expired)

### Option B: Accept userId prop (recommended)
Add `userId: string` to Props. Parent passes `data.profile.id`.
- **Pros:** No async call, no null risk, explicit dependency
- **Cons:** Adds one more prop

## Acceptance Criteria

- [ ] No `supabase.auth.getUser()` call in the component
- [ ] User ID comes from prop or cached session

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | Architecture claim corrected -- project DOES have components that accept supabase and do mutations |

## Resources

- [PR #20](https://github.com/kamikaziii/bareCourier/pull/20)
