---
status: pending
priority: p2
issue_id: "239"
tags: [code-review, pr-14, security, information-disclosure]
dependencies: []
---

# Generic Catch Block Error Leak

## Problem Statement

The main catch block in the send-email edge function returns the raw error message to clients, potentially exposing stack traces, file paths, or internal implementation details.

**Why it matters:**
- JavaScript errors may contain stack traces
- File paths and module names could be exposed
- Internal error messages may reveal system architecture
- Attackers can use this information for reconnaissance

## Findings

**Location:** `supabase/functions/send-email/index.ts:624-628`

**Current code:**
```typescript
} catch (error) {
  return new Response(
    JSON.stringify({ error: (error as Error).message }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**Potential exposure:**
- Error messages from failed JSON parsing
- Network error details
- Timeout messages with internal timing info
- Supabase client errors

## Proposed Solutions

### Option A: Generic Error Response (Recommended)
**Pros:** Simple, secure
**Cons:** Harder to debug from client side
**Effort:** Small
**Risk:** Very Low

```typescript
} catch (error) {
  console.error('[send-email] Unexpected error:', error);
  return new Response(
    JSON.stringify({ error: "Internal server error" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Option B: Error Classification
**Pros:** Balances security with debugging
**Cons:** More code
**Effort:** Small
**Risk:** Very Low

```typescript
} catch (error) {
  console.error('[send-email] Unexpected error:', error);

  // Only expose safe error categories
  const safeMessage = error instanceof TypeError
    ? "Invalid request format"
    : "Internal server error";

  return new Response(
    JSON.stringify({ error: safeMessage }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

## Recommended Action

Implement Option A for immediate security improvement.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Lines:** 624-628
- **Related:** #238 (Resend error disclosure)

## Acceptance Criteria

- [ ] Replace raw error.message with generic message
- [ ] Add console.error for server-side logging
- [ ] Test with various error types (network, parse, timeout)
- [ ] Verify no stack traces leak to client

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #14 security review | Generic catches need sanitization |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- OWASP Error Handling: https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html
