---
status: ready
priority: p2
issue_id: "238"
tags: [code-review, pr-14, security, information-disclosure]
dependencies: []
---

# Error Response Information Disclosure

## Problem Statement

The send-email edge function returns raw Resend API error details to clients, potentially exposing internal implementation details, API error codes, and validation messages.

**Why it matters:**
- Leaks internal API behavior to external callers
- Could expose Resend-specific error codes and messages
- Violates principle of minimal information disclosure
- May aid attackers in understanding system internals

## Findings

**Location:** `supabase/functions/send-email/index.ts:604-609`

**Current code:**
```typescript
if (!resendResponse.ok) {
  const errorData = await resendResponse.json();
  return new Response(
    JSON.stringify({ error: `Resend API error: ${JSON.stringify(errorData)}` }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**What gets exposed:**
- Resend error names (e.g., `rate_limit_exceeded`, `validation_error`)
- Detailed error messages from Resend
- Potentially sensitive API response structure

## Proposed Solutions

### Option A: Generic Error Message (Recommended)
**Pros:** Simple, secure, follows best practices
**Cons:** Less debugging info for callers
**Effort:** Small
**Risk:** Very Low

```typescript
if (!resendResponse.ok) {
  const errorData = await resendResponse.json();
  console.error('[send-email] Resend API error:', JSON.stringify(errorData));
  return new Response(
    JSON.stringify({ error: "Failed to send email" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Option B: Structured Error Codes (More work but better DX)
**Pros:** Machine-parseable, good agent support
**Cons:** More implementation effort
**Effort:** Medium
**Risk:** Low

```typescript
if (!resendResponse.ok) {
  const errorData = await resendResponse.json();
  console.error('[send-email] Resend API error:', JSON.stringify(errorData));

  const errorCode = mapResendError(errorData.name);
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: errorCode,
        message: "Failed to send email",
        retryable: errorCode === "rate_limit"
      }
    }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

## Recommended Action

Implement Option A as immediate fix. Consider Option B as part of #241 (structured error codes).

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Lines:** 604-609
- **Related:** Also see #239 (generic catch error leak)

## Acceptance Criteria

- [ ] Replace detailed Resend error with generic message
- [ ] Log detailed error server-side for debugging
- [ ] Ensure error response doesn't leak API internals
- [ ] Test error handling with invalid API key

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #14 security review | Error responses should be sanitized |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- OWASP Information Disclosure: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/
