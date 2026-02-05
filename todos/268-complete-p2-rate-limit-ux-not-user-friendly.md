---
status: complete
priority: p2
issue_id: "268"
tags: [code-review, ux, frontend, toast, pr-15, pr-16]
dependencies: []
---

# Rate Limit Errors Not User-Friendly in Client Creation

## Problem Statement

When the `create-client` edge function returns a 429 rate limit error with structured error data (including `retryAfterMs`), the frontend shows a generic "Failed to create client" error instead of informing the user:
1. That they're rate-limited
2. How long to wait before retrying

**Why it matters:**
- Poor user experience - users don't understand why the action failed
- Backend provides excellent structured error data that goes unused
- Users may repeatedly retry, getting frustrated
- Inconsistent with the design intent of PR #15 (structured rate limit responses)

## Findings

**Location:** `src/routes/courier/clients/new/+page.svelte` (lines 113-117)

```typescript
if (!response.ok) {
  toast.error(m.error_create_client_failed(), { duration: 8000 });
  loading = false;
  return;
}
```

**Backend provides (from create-client):**
```json
{
  "error": {
    "code": "RATE_LIMIT",
    "message": "Please wait before sending another invitation to this email",
    "retryable": true,
    "retryAfterMs": 3540000
  }
}
```

**Current behavior:** User sees "Failed to create client"
**Expected behavior:** User sees "Please wait X minutes before resending invitation to this email"

## Proposed Solutions

### Option A: Check for rate limit error and show specific message (Recommended)
**Pros:** User-friendly, uses backend data, matches toast patterns
**Cons:** Adds conditional logic
**Effort:** Small
**Risk:** Very Low

```typescript
const result = await response.json();

if (!response.ok) {
  if (response.status === 429 && result.error?.code === 'RATE_LIMIT') {
    const minutes = Math.ceil((result.error.retryAfterMs || 3600000) / 60000);
    toast.error(m.rate_limit_wait({ minutes }), { duration: 8000 });
  } else {
    toast.error(m.error_create_client_failed(), { duration: 8000 });
  }
  loading = false;
  return;
}
```

**Required i18n key:**
```json
{
  "rate_limit_wait": "Please wait {minutes} minutes before trying again"
}
```

### Option B: Show backend message directly for rate limits
**Pros:** Simpler, uses pre-localized message from backend
**Cons:** Less control over frontend formatting
**Effort:** Small
**Risk:** Low

```typescript
if (!response.ok) {
  if (response.status === 429 && result.error?.message) {
    toast.error(result.error.message, { duration: 8000 });
  } else {
    toast.error(m.error_create_client_failed(), { duration: 8000 });
  }
  // ...
}
```

### Option C: Create reusable rate limit handler
**Pros:** Consistent across app, DRY
**Cons:** More setup, may be overkill for single use case
**Effort:** Medium
**Risk:** Low

## Recommended Action

Implement Option A for proper i18n support and consistent user experience.

## Technical Details

- **Affected files:**
  - `src/routes/courier/clients/new/+page.svelte` (lines 111-117)
  - `messages/en.json` (add rate_limit_wait key)
  - `messages/pt-PT.json` (add rate_limit_wait key)
- **Also check:** `src/routes/courier/clients/[id]/ClientInfoTab.svelte` for resend invitation
- **Backend already fixed:** PR #15 todo #263 added structured rate limit response

## Acceptance Criteria

- [ ] 429 responses show user-friendly "wait X minutes" message
- [ ] i18n keys added for both EN and PT-PT
- [ ] Generic error shown for non-rate-limit failures
- [ ] Duration calculation is correct (ms to minutes)
- [ ] Works for both new client creation and invitation resend

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from post-merge review of PRs #13-16 | Backend structured errors need frontend support |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15 (backend rate limit)
- PR #16: https://github.com/kamikaziii/bareCourier/pull/16 (toast system)
- Todo #263: Rate limit structured response (completed)
