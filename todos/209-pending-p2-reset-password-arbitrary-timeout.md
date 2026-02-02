---
status: pending
priority: p2
issue_id: "209"
tags: [ux, auth, code-review]
dependencies: []
---

# Fix Arbitrary Timeout in Reset Password Page

## Problem Statement

The reset password page uses an arbitrary 3-second timeout to detect if the password recovery token is valid. This creates UX issues:
1. The 3-second timeout is arbitrary and may be too short on slow connections
2. Users experience unnecessary delay even with valid tokens
3. If user refreshes after token is consumed, they see "invalid link" even if they haven't set a password

**Note:** The original claim of a "race condition" where PASSWORD_RECOVERY fires before onMount was overstated. In SvelteKit, auth events fire client-side after hydration, and the code does have a fallback (getSession check). The real issue is the arbitrary delay and lack of immediate session check.

**Impact:** Users experience unnecessary 3-second delays and may see false "invalid link" errors on slow connections.

## Findings

- **File:** `src/routes/reset-password/+page.svelte` (lines 25-51)
- **Current behavior:**
  - onMount sets up auth state change listener
  - Waits for PASSWORD_RECOVERY or SIGNED_IN events
  - Falls back to getSession() after 3-second timeout
- **Problems identified:**
  1. 3-second timeout is arbitrary - slow networks may not complete in time
  2. No immediate session check on component initialization (waits for event or timeout)
  3. Unnecessary delay for users with already-processed tokens

**Code evidence:**
```svelte
onMount(() => {
  const { data: authListener } = data.supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      isValidSession = true;
      checking = false;
    }
    // ...
  });

  const timeout = setTimeout(() => {
    if (checking) {
      checking = false;
      // Fallback session check - but why wait 3 seconds?
      data.supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) isValidSession = true;
      });
    }
  }, 3000);  // Arbitrary - should check session immediately instead
});
```

## Proposed Solutions

### Option 1: Check Session First on Mount (Recommended)

**Approach:** Immediately check for an existing session on mount, before setting up the event listener. This handles the case where the token was already processed.

**Pros:**
- Handles already-processed tokens
- No arbitrary timeouts
- More reliable for slow connections
- Simpler logic

**Cons:**
- None identified

**Effort:** 30 minutes

**Risk:** Low

**Implementation:**
```svelte
onMount(async () => {
  // First, check if we already have a valid recovery session
  const { data: { session } } = await data.supabase.auth.getSession();
  if (session) {
    isValidSession = true;
    checking = false;
    return;
  }

  // Listen for PASSWORD_RECOVERY event (for fresh token processing)
  const { data: authListener } = data.supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
      isValidSession = true;
      checking = false;
    }
  });

  // Reduced timeout as fallback only
  const timeout = setTimeout(() => {
    if (checking) {
      checking = false;
      // Session check already done above, so this is truly an invalid link
    }
  }, 5000);

  return () => {
    authListener.subscription.unsubscribe();
    clearTimeout(timeout);
  };
});
```

---

### Option 2: Server-Side Token Validation

**Approach:** Validate the token server-side in +page.server.ts before rendering the page.

**Pros:**
- No client-side race conditions
- More secure (token handling on server)

**Cons:**
- Requires server-side changes
- More complex implementation

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

_To be filled during triage._

## Technical Details

**Affected files:**
- `src/routes/reset-password/+page.svelte:25-57` - onMount logic

**Related components:**
- Supabase Auth state management
- Password recovery email flow

## Resources

- **Supabase Docs:** Password recovery flow
- **Related issue:** Email enumeration vulnerability (Issue 208)

## Acceptance Criteria

- [ ] Session checked immediately on mount
- [ ] Valid recovery sessions detected without waiting
- [ ] No 3-second delay for users with valid tokens
- [ ] Invalid/expired tokens show error promptly
- [ ] Page refresh after token consumption handled gracefully
- [ ] Slow networks don't cause false "invalid link" errors

## Work Log

### 2026-02-02 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Identified arbitrary timeout in reset-password page token validation
- Analyzed onMount logic at lines 25-51
- Proposed session-first check approach to eliminate unnecessary delay

**Learnings:**
- Session check should happen immediately on mount, not after arbitrary timeout
- Event listener is still needed for fresh token processing, but shouldn't be the only path

## Notes

- Related to Issue 208 (email enumeration) - both are part of forgot password flow
- Consider testing with slow network simulation
