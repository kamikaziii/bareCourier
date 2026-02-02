---
status: complete
priority: p1
issue_id: "208"
tags: [security, auth, code-review]
dependencies: []
---

# Fix Email Enumeration Vulnerability in Forgot Password

## Problem Statement

The forgot password page reveals whether an email exists in the system by showing different responses for success vs error cases. An attacker can use this to enumerate valid email addresses, which is a security risk for user privacy and a prerequisite for targeted phishing attacks.

**Security Impact:** Users' email addresses can be confirmed/denied, enabling targeted attacks.

## Findings

- **File:** `src/routes/forgot-password/+page.svelte` (lines 27-35)
- **Current behavior:**
  - On Supabase error: Shows error message and returns early (line 28-30)
  - On success: Shows "submitted = true" success message (line 34)
- This creates a timing oracle: attackers can distinguish "email exists" from "error occurred"
- The comment on line 33 claims to prevent enumeration but the code doesn't achieve this

**Code evidence:**
```svelte
if (resetError) {
  error = resetError.message;  // ❌ Shows Supabase error to user
  loading = false;
  return;  // ❌ Returns early, doesn't show success message
}
// Always show success message (prevents email enumeration) ← Comment is misleading
submitted = true;  // Only reached if no error
```

## Proposed Solutions

### Option 1: Always Show Success (Recommended)

**Approach:** Show the success message regardless of whether Supabase returns an error. Only show error for network/timeout failures.

**Pros:**
- Eliminates email enumeration completely
- Simple implementation
- Follows security best practices (OWASP recommendation)

**Cons:**
- Users won't know if rate limiting occurred
- Slightly worse UX for legitimate errors

**Effort:** 15 minutes

**Risk:** Low

**Implementation:**
```svelte
async function handleSubmit(e: Event) {
  e.preventDefault();
  loading = true;
  error = "";

  try {
    await data.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${localizeHref("/reset-password")}`,
    });
  } catch (networkError) {
    // Only show error for network failures, not for "email not found"
    error = m.error_try_again_later();
    loading = false;
    return;
  }

  // Always show success regardless of whether email exists
  submitted = true;
  loading = false;
}
```

---

### Option 2: Rate Limit Display Only

**Approach:** Show success for all cases except rate limiting, which users need to know about.

**Pros:**
- Better UX for rate limiting scenario
- Still prevents enumeration for most cases

**Cons:**
- Rate limiting response might still leak timing info
- More complex logic

**Effort:** 30 minutes

**Risk:** Medium (rate limit detection could still leak info)

## Recommended Action

_To be filled during triage._

## Technical Details

**Affected files:**
- `src/routes/forgot-password/+page.svelte:27-35` - handleSubmit function

**Related components:**
- Supabase Auth API
- Password reset email flow

## Resources

- **OWASP Guidance:** Authentication error messages should be generic
- **Related:** Password reset flow implementation

## Acceptance Criteria

- [ ] Success message shown regardless of whether email exists
- [ ] Network errors show generic "try again later" message
- [ ] No information leakage about email existence
- [ ] Test: Submit with valid email → success message
- [ ] Test: Submit with invalid email → same success message
- [ ] Test: Network failure → generic error message

## Work Log

### 2026-02-02 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Identified email enumeration vulnerability in forgot-password page
- Analyzed code flow at lines 27-35
- Verified that error path returns early, success path shows different UI
- Documented fix approach

**Learnings:**
- Comment in code claims to prevent enumeration but implementation doesn't achieve it
- Supabase error types would need to be checked if we want rate-limit-specific handling

## Notes

- CRITICAL: This is a security vulnerability that should be fixed before the feature goes to production
- Consider adding a translation key for generic "try again later" message if not exists
