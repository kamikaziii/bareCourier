---
status: ready
priority: p1
issue_id: "258"
tags: [code-review, security, pr-15, error-handling]
dependencies: []
---

# Error Message Disclosure in accept-invite Flow

## Problem Statement

The accept-invite page displays raw Supabase Auth error messages directly to users. This can expose internal details about token states, password policies, and validation internals.

**Why it matters:**
- Information disclosure that could aid attackers
- Inconsistent with error handling elsewhere in the app
- Poor user experience (technical jargon instead of friendly messages)

## Findings

**Location:** `src/routes/accept-invite/+page.svelte` lines 96-97

```svelte
if (updateError) {
    error = updateError.message;  // Raw Supabase error exposed
    loading = false;
    return;
}
```

**Risk:** Supabase Auth errors can contain:
- Token expiration details
- Password policy requirements
- Internal validation states

## Proposed Solutions

### Option A: Map to localized messages (Recommended)
**Pros:** Consistent UX, security-safe, i18n-ready
**Cons:** Requires mapping common error patterns
**Effort:** Small
**Risk:** Very Low

```svelte
if (updateError) {
    // Map common auth errors to user-friendly messages
    if (updateError.message.includes('expired')) {
        error = m.password_link_expired();
    } else if (updateError.message.includes('weak')) {
        error = m.password_too_weak();
    } else {
        error = m.error_setting_password();
    }
    loading = false;
    return;
}
```

### Option B: Generic fallback only
**Pros:** Simplest fix
**Cons:** Less specific feedback to users
**Effort:** Small
**Risk:** Very Low

```svelte
if (updateError) {
    error = m.error_setting_password();
    loading = false;
    return;
}
```

## Recommended Action

Implement Option A for better UX while maintaining security.

## Technical Details

- **Affected file:** `src/routes/accept-invite/+page.svelte`
- **Lines:** 96-97
- **Related i18n keys needed:** `password_link_expired`, `password_too_weak`, `error_setting_password`

## Acceptance Criteria

- [ ] Raw `updateError.message` is never displayed to users
- [ ] Common auth errors are mapped to localized messages
- [ ] Fallback message exists for unknown errors
- [ ] Original error is logged to console for debugging (optional)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from post-merge audit | Auth errors need sanitization |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
- Supabase Auth error reference: https://supabase.com/docs/reference/javascript/auth-error-codes
