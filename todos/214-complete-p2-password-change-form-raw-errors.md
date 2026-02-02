---
status: complete
priority: p2
issue_id: "214"
tags: [security, auth, error-handling, code-review]
dependencies: []
---

# Map Raw Error Messages to User-Friendly Messages in PasswordChangeForm

## Problem Statement

The PasswordChangeForm component displays raw Supabase Auth error messages directly to users. These technical error messages can:
1. Confuse users who don't understand technical jargon
2. Potentially leak information about the authentication system
3. Provide inconsistent error experience across the application

**Impact:** Poor UX and minor information disclosure risk.

## Findings

- **Component:** PasswordChangeForm (likely in settings or profile pages)
- **Current behavior:**
  - Raw Supabase error messages like `AuthApiError: ...` shown to users
  - Technical details exposed (e.g., rate limiting, token issues)
  - Inconsistent with rest of app which maps errors
- **Common Supabase Auth errors that need mapping:**
  - `Password should be at least 6 characters`
  - `New password should be different from the old password`
  - `User not found`
  - Rate limiting errors
  - Network errors

## Proposed Solutions

### Option 1: Error Message Mapping (Recommended)

**Approach:** Create a mapping function that converts known Supabase error codes/messages to user-friendly translated strings.

**Pros:**
- Consistent user experience
- Supports i18n
- Hides technical details
- Can be reused across auth-related components

**Cons:**
- Need to maintain mapping as Supabase errors change

**Effort:** 30 minutes

**Risk:** Low

**Implementation:**
```typescript
function mapAuthError(error: AuthError): string {
  const errorMap: Record<string, () => string> = {
    'Password should be at least 6 characters': () => m.password_min_length(),
    'New password should be different from the old password': () => m.password_must_differ(),
    'Invalid login credentials': () => m.invalid_credentials(),
    'Email rate limit exceeded': () => m.too_many_attempts(),
    'User not found': () => m.user_not_found(),
  };

  // Check for known error patterns
  for (const [pattern, getMessage] of Object.entries(errorMap)) {
    if (error.message.includes(pattern)) {
      return getMessage();
    }
  }

  // Fallback to generic error
  console.error('Unmapped auth error:', error.message);
  return m.error_try_again_later();
}
```

**Usage:**
```svelte
const { error: authError } = await data.supabase.auth.updateUser({
  password: newPassword
});

if (authError) {
  error = mapAuthError(authError);
  return;
}
```

---

### Option 2: Create Shared Auth Error Handler

**Approach:** Create a shared utility in `$lib/utils/auth-errors.ts` that can be used across all auth-related components.

**Pros:**
- Single source of truth
- Easier maintenance
- Reusable across login, forgot password, reset password, etc.

**Cons:**
- Slightly more setup
- Need to identify all auth components

**Effort:** 45 minutes

**Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

**Affected files:**
- PasswordChangeForm component (location TBD - check settings pages)
- Potentially shared with:
  - Login page
  - Forgot password page
  - Reset password page

**Related components:**
- Supabase Auth API
- i18n/translation system (Paraglide)

## Resources

- **Supabase Auth Errors:** https://supabase.com/docs/reference/javascript/auth-error-codes
- **Related:** Issue 137 (raw error messages in form actions)
- **Related:** Issue 075 (login error message exposure)

## Acceptance Criteria

- [ ] All common auth errors mapped to user-friendly messages
- [ ] Unknown errors show generic "try again" message
- [ ] Unknown errors logged server-side/console for debugging
- [ ] Translations available for mapped messages (PT-PT + EN)
- [ ] Test: Invalid password → user-friendly error
- [ ] Test: Rate limiting → user-friendly error
- [ ] Test: Unknown error → generic message (not raw error)

## Work Log

### 2026-02-02 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Identified raw error message display in PasswordChangeForm
- Documented common Supabase auth errors that need mapping
- Proposed error mapping function approach

**Learnings:**
- Supabase auth errors are technical and user-unfriendly
- Error mapping should be centralized for consistency
- Consider creating shared utility for all auth error handling

## Notes

- Check if translation keys for error messages already exist
- Consider adding new keys: `password_must_differ`, `too_many_attempts`, `user_not_found` if missing
- This pattern should be consistent with how other pages handle auth errors
