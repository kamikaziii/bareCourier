---
status: ready
priority: p1
issue_id: "232"
tags: [code-review, security, pr-16]
dependencies: []
---

# Unvalidated Error Messages from Edge Functions

## Problem Statement

Edge function error messages are displayed directly to users via toast without validation or sanitization. This creates a **sensitive data exposure vulnerability** that could leak internal error details.

**Why it matters:** Attackers could exploit this to extract database schema info, stack traces, internal service names, or technical implementation details.

## Findings

**Source:** Security Sentinel Agent

**Locations:**
- `src/routes/courier/clients/new/+page.svelte:111` - `toast.error(result.error || m.error_create_client_failed())`
- `src/routes/courier/clients/[id]/+page.svelte:129` - `toast.error(result.error || m.password_reset_error())`

**Risk:** Information disclosure, system reconnaissance attacks

**OWASP Categories Violated:**
- A04:2021 - Insecure Design
- A05:2021 - Security Misconfiguration

## Proposed Solutions

### Option A: Error Code Mapping (Recommended)
Map server error codes to safe, localized messages.

```typescript
const safeErrorMessages: Record<string, string> = {
  'DUPLICATE_EMAIL': m.error_email_exists(),
  'INVALID_PASSWORD': m.error_password_invalid(),
  // ... map known errors
};

const errorMessage = safeErrorMessages[result.error] || m.error_create_client_failed();
toast.error(errorMessage, { duration: Infinity });
```

**Pros:** Most secure, ensures i18n compliance
**Cons:** Requires backend changes to return error codes
**Effort:** Medium
**Risk:** Low

### Option B: Whitelist Known Safe Messages
Only display messages that match a known safe pattern.

**Pros:** Quick to implement
**Cons:** Less flexible, may need frequent updates
**Effort:** Small
**Risk:** Medium (might miss edge cases)

### Option C: Generic Error Messages Only
Always show generic error, log details server-side.

**Pros:** Simplest, most secure
**Cons:** Less helpful UX for users
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Fill after triage -->

## Technical Details

**Affected files:**
- `src/routes/courier/clients/new/+page.svelte`
- `src/routes/courier/clients/[id]/+page.svelte`

**Components:** Toast error handling

## Acceptance Criteria

- [ ] No raw error messages from edge functions displayed to users
- [ ] All error messages use localized strings from paraglide
- [ ] Server-side logging captures detailed errors for debugging
- [ ] Security test: Trigger edge function error, verify no sensitive data exposed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Security sentinel found information disclosure risk |

## Resources

- PR #16: feat: implement toast notification system
- OWASP A04:2021 - Insecure Design
- OWASP A05:2021 - Security Misconfiguration
