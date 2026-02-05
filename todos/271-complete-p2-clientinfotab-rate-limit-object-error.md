---
status: complete
priority: p2
issue_id: "271"
tags: [code-review, ux, frontend, bug, pr-15]
dependencies: []
---

# ClientInfoTab Shows [object Object] for Rate Limit Errors

## Problem Statement

When resending a client invitation via `ClientInfoTab.svelte` triggers a rate limit (429 response), the error display shows `[object Object]` instead of a readable error message. This is because the backend returns a structured error object, but the frontend expects a string.

**Why it matters:**
- Users see `[object Object]` - completely unusable error message
- More severe than just "unhelpful" - it's broken/unreadable
- Creates confusion about what went wrong
- Same backend structure used by new client page (todo #268)

## Findings

**Location:** `src/routes/courier/clients/[id]/ClientInfoTab.svelte` (line 158)

```typescript
if (!response.ok) {
  resendError = result.error || m.error_generic();
}
```

**Backend 429 response structure from `create-client`:**
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

**Current behavior:**
- `result.error` is the object `{ code: "RATE_LIMIT", message: "...", ... }`
- `resendError = result.error` sets resendError to that object
- Template `{resendError}` renders as `[object Object]`

**Expected behavior:**
- Extract `result.error.message` for display
- Show minutes until retry from `retryAfterMs`
- Localized user-friendly message

## Proposed Solutions

### Option A: Handle structured error response (Recommended)
**Pros:** Proper error handling, uses backend data, matches #268 fix pattern
**Cons:** Slightly more logic
**Effort:** Small
**Risk:** Very Low

```typescript
if (!response.ok) {
  if (response.status === 429 && result.error?.code === 'RATE_LIMIT') {
    const minutes = Math.ceil((result.error.retryAfterMs || 3600000) / 60000);
    resendError = m.rate_limit_wait({ minutes });
  } else if (typeof result.error === 'string') {
    resendError = result.error;
  } else if (result.error?.message) {
    resendError = result.error.message;
  } else {
    resendError = m.error_generic();
  }
}
```

### Option B: Check if error is object vs string
**Pros:** Handles both formats gracefully
**Cons:** Less specific error message for rate limits
**Effort:** Small
**Risk:** Very Low

```typescript
if (!response.ok) {
  if (typeof result.error === 'object' && result.error?.message) {
    resendError = result.error.message;
  } else {
    resendError = result.error || m.error_generic();
  }
}
```

### Option C: Use same pattern as new client page
**Pros:** Consistency across codebase
**Cons:** Requires coordinating with #268
**Effort:** Small (if done with #268)
**Risk:** Very Low

## Recommended Action

Implement Option A alongside todo #268 to ensure consistent rate limit handling across both invitation flows.

## Technical Details

- **Affected file:** `src/routes/courier/clients/[id]/ClientInfoTab.svelte` (line 158)
- **Related todo:** #268 (same issue on new client page)
- **i18n keys needed:** Same as #268 (`rate_limit_wait`)
- **Backend already fixed:** PR #15 added structured rate limit response

## Acceptance Criteria

- [ ] 429 rate limit errors show user-friendly "wait X minutes" message
- [ ] Other errors with message property show that message
- [ ] String errors still work (backwards compatible)
- [ ] Generic fallback for unknown error formats
- [ ] Consistent with new client page (#268)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from second post-merge review sweep | Backend structured errors need type checking in frontend |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15 (backend rate limit)
- Todo #268: Rate limit UX in new client page (related)
- File: `src/routes/courier/clients/[id]/ClientInfoTab.svelte`

