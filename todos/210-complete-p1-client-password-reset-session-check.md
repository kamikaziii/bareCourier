---
status: complete
priority: p1
issue_id: "210"
tags: [security, auth, code-review]
dependencies: []
---

# Add Session Validation Before Client Password Reset API Call

## Problem Statement

The client password reset function makes an API call with the access token without first validating that the session exists. If the session is expired or null, the code sends `Authorization: Bearer undefined` which results in a confusing 401 error that doesn't help the user understand their session expired.

**Impact:** Users with expired sessions see confusing errors instead of being prompted to log in again.

## Findings

- **File:** `src/routes/courier/clients/[id]/+page.svelte` (lines 87-94)
- **Current behavior:**
  - Gets session data without checking if session exists
  - Uses optional chaining on access_token which results in undefined
  - Sends "Bearer undefined" to API
  - API returns 401 which is caught as generic error
- **User experience:** Confusing error message instead of "session expired, please log in"

**Code evidence:**
```svelte
const { data: sessionData } = await data.supabase.auth.getSession();
const response = await fetch(
  `${PUBLIC_SUPABASE_URL}/functions/v1/reset-client-password`,
  {
    headers: {
      Authorization: `Bearer ${sessionData.session?.access_token}`,  // ❌ Can be undefined
```

## Proposed Solutions

### Option 1: Check Session Before Fetch (Recommended)

**Approach:** Validate the session exists before making the API call. Show a session-expired message if not.

**Pros:**
- Clear error message for users
- Prevents confusing API errors
- Simple implementation

**Cons:**
- None identified

**Effort:** 15 minutes

**Risk:** Low

**Implementation:**
```svelte
async function handleResetPassword() {
  if (newPassword.length < 6) {
    passwordResetError = m.password_min_length();
    return;
  }

  passwordResetLoading = true;
  passwordResetError = "";

  try {
    const { data: sessionData } = await data.supabase.auth.getSession();

    // Validate session exists
    if (!sessionData.session?.access_token) {
      passwordResetError = m.session_expired();
      passwordResetLoading = false;
      return;
    }

    const response = await fetch(
      `${PUBLIC_SUPABASE_URL}/functions/v1/reset-client-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        // ...
```

---

### Option 2: Refresh Session First

**Approach:** Attempt to refresh the session before checking, to handle nearly-expired tokens.

**Pros:**
- Handles edge case of tokens about to expire
- Better user experience

**Cons:**
- More complex
- Adds latency

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

**Affected files:**
- `src/routes/courier/clients/[id]/+page.svelte:87-94` - handleResetPassword function

**Related components:**
- Supabase Auth session management
- Edge function: reset-client-password

## Resources

- **Related:** Edge function handles 401 correctly, but user experience is poor

## Acceptance Criteria

- [ ] Session validated before API call
- [ ] Expired session shows user-friendly "session expired" message
- [ ] Valid session proceeds with password reset
- [ ] Test: Expired session → clear error message
- [ ] Test: Valid session → password reset works

## Work Log

### 2026-02-02 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Identified missing session validation in handleResetPassword function
- Analyzed code at lines 87-94
- Noted that "Bearer undefined" is sent when session is null
- Proposed session check before fetch

**Learnings:**
- Optional chaining on access_token allows undefined to be interpolated into string
- User-facing error messages should be specific to the problem

## Notes

- Consider if m.session_expired() translation key exists; if not, add it
- This pattern should be checked in other places that make authenticated API calls
