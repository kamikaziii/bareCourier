---
status: pending
priority: p3
issue_id: "213"
tags: [ux, auth, code-review]
dependencies: []
---

# Password Reset Dialog State Not Reset on Re-open

## Problem Statement

When the password reset dialog is closed and re-opened, the previous state (error messages, success messages, loading state, input values) may persist. This leads to confusing UX where users see stale error messages or previous form data when they open the dialog again.

**Impact:** Minor UX issue - users may be confused by stale state in the dialog.

## Findings

- **Component:** Password reset dialog (likely in client detail page or settings)
- **Current behavior:**
  - Dialog opens with previous state preserved
  - Error/success messages from previous attempt visible
  - Form inputs may retain previous values
- **Expected behavior:**
  - Dialog should reset to initial state when opened
  - Clean form with no error messages
  - Empty or default input values

## Proposed Solutions

### Option 1: Reset State on Dialog Open (Recommended)

**Approach:** Add an effect or callback that resets all form state when the dialog's open state changes to true.

**Pros:**
- Clean UX - users always see fresh dialog
- Simple implementation
- Follows dialog best practices

**Cons:**
- None identified

**Effort:** 15 minutes

**Risk:** Low

**Implementation:**
```svelte
let dialogOpen = $state(false);
let password = $state('');
let error = $state('');
let success = $state(false);
let loading = $state(false);

$effect(() => {
  if (dialogOpen) {
    // Reset state when dialog opens
    password = '';
    error = '';
    success = false;
    loading = false;
  }
});
```

---

### Option 2: Use {#key} Block

**Approach:** Wrap dialog content in a {#key dialogOpen} block to force re-creation.

**Pros:**
- Guarantees fresh state
- Works for complex nested state

**Cons:**
- Destroys/recreates DOM unnecessarily
- Heavier than needed for this case

**Effort:** 10 minutes

**Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

**Affected files:**
- Password reset dialog component (location TBD)
- Client detail page if dialog is inline

**Related components:**
- Dialog component from shadcn-svelte
- Form state management

## Resources

- **Related:** Password change form error handling (Issue 214)

## Acceptance Criteria

- [ ] Dialog state resets when opened
- [ ] No stale error messages visible
- [ ] No stale success messages visible
- [ ] Form inputs are empty/default
- [ ] Test: Open dialog → enter data → close → re-open → form is clean

## Work Log

### 2026-02-02 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Identified dialog state persistence issue from security review findings
- Documented expected vs actual behavior
- Proposed $effect reset approach

**Learnings:**
- Dialog state should always be reset on open for clean UX
- Svelte 5 $effect can watch for open state changes

## Notes

- This is a UX improvement, not a security issue
- Same pattern should be applied to other dialogs with form state
