---
status: complete
priority: p3
issue_id: "270"
tags: [code-review, ux, frontend, toast, pr-15, pr-16]
dependencies: []
---

# Resend vs New Invitation Not Distinguished in Toast

## Problem Statement

When creating a client via invitation flow, the success toast shows the same message whether it's a new invitation or a resend to an existing unconfirmed user. Users don't know if they've sent a duplicate invitation.

**Why it matters:**
- Minor UX confusion - user doesn't know if this was a new user or resend
- Backend provides `result.resend` flag that goes unused
- Could lead to confusion if courier thinks they created a new client but actually resent to existing

## Findings

**Location:** `src/routes/courier/clients/new/+page.svelte` (lines 169-173)

```typescript
// Show appropriate toast messages
if (result.invitation_sent) {
  toast.success(m.invitation_sent({ email: email.trim() }));
} else {
  toast.success(m.toast_client_created());
}
```

**Backend response includes:**
```json
{
  "success": true,
  "user": { "id": "...", "email": "..." },
  "invitation_sent": true,
  "resend": true  // <-- This flag is ignored
}
```

**Current behavior:** Both new and resend show "Invitation sent to {email}"
**Better behavior:** Resend shows "Invitation resent to {email}" or similar

## Proposed Solutions

### Option A: Show different message for resend (Recommended)
**Pros:** Clear feedback, uses backend data, simple change
**Cons:** Adds conditional, new i18n key
**Effort:** Small
**Risk:** Very Low

```typescript
if (result.invitation_sent) {
  if (result.resend) {
    toast.success(m.invitation_resent({ email: email.trim() }));
  } else {
    toast.success(m.invitation_sent({ email: email.trim() }));
  }
} else {
  toast.success(m.toast_client_created());
}
```

**Required i18n key:**
```json
{
  "invitation_resent": "Invitation resent to {email}"
}
```

### Option B: Add "resent" indicator to existing message
**Pros:** Single message key
**Cons:** Less clear
**Effort:** Small
**Risk:** Very Low

```typescript
const messageKey = result.resend ? 'invitation_sent_resend' : 'invitation_sent';
toast.success(m[messageKey]({ email: email.trim() }));
```

### Option C: Keep as-is
**Pros:** No change needed
**Cons:** Minor UX gap remains
**Effort:** None
**Risk:** None

## Recommended Action

Implement Option A for clear user feedback.

## Technical Details

- **Affected files:**
  - `src/routes/courier/clients/new/+page.svelte` (lines 169-173)
  - `messages/en.json` (add invitation_resent key)
  - `messages/pt-PT.json` (add invitation_resent key)
- **Also consider:** `src/routes/courier/clients/[id]/ClientInfoTab.svelte` resend button

## Acceptance Criteria

- [ ] New invitations show "Invitation sent to {email}"
- [ ] Resend invitations show "Invitation resent to {email}"
- [ ] i18n keys added for both EN and PT-PT
- [ ] Works in both new client page and client detail resend

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from post-merge review of PRs #13-16 | Backend flags should inform UI feedback |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15 (invitation flow)
- PR #16: https://github.com/kamikaziii/bareCourier/pull/16 (toast system)
