---
status: complete
priority: p2
issue_id: "217"
tags: [code-review, security, pr-15]
dependencies: []
completed_at: 2026-02-04
---

# P2: IDOR Vulnerability in check-client-status Endpoint

## Problem Statement

The `check-client-status` endpoint allows any authenticated courier to check the email confirmation status of ANY user ID, not just clients. This could leak information about other users.

**Why it matters:** A malicious courier could enumerate user IDs to discover information about other users (couriers, other system users), including their email addresses.

## Findings

**Location:** `supabase/functions/check-client-status/index.ts:92-99`

```typescript
// No validation that client_id is actually a client
const { data: { user: clientUser }, error: clientError } =
  await adminClient.auth.admin.getUserById(client_id);

// Returns email for ANY valid user ID
return new Response(
  JSON.stringify({
    client_id: clientUser.id,
    email: clientUser.email,  // ← Could be another courier's email
    email_confirmed_at: clientUser.email_confirmed_at,
    is_confirmed: !!clientUser.email_confirmed_at,
    created_at: clientUser.created_at,
  }),
  ...
);
```

**Issue:** The function verifies the caller is a courier but does not verify:
1. The target `client_id` actually belongs to a client (not another courier)
2. The client has any relationship to this courier

## Proposed Solutions

### Option A: Add client role validation (Recommended)
**Pros:** Simple fix, follows existing patterns
**Cons:** None
**Effort:** Small (~10 lines)
**Risk:** Very Low

```typescript
// After getting clientUser, add:
const { data: clientProfile } = await adminClient
  .from("profiles")
  .select("role")
  .eq("id", client_id)
  .single();

if (!clientProfile || clientProfile.role !== "client") {
  return new Response(
    JSON.stringify({ error: "Client not found" }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Option B: Only return confirmation status, not email
**Pros:** Minimizes information disclosure
**Cons:** May break UI expectations
**Effort:** Small
**Risk:** Low (need to check UI usage)

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `supabase/functions/check-client-status/index.ts`

**Components affected:**
- Client detail page (check status call)
- Resend invitation feature

**Database changes:** None required

## Acceptance Criteria

- [x] Endpoint returns 404 for non-client user IDs
- [x] Endpoint works normally for client user IDs
- [x] UI handles 404 gracefully (doesn't break)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Security agent flagged IDOR risk |
| 2026-02-04 | Implemented Option A fix | Added role validation after getUserById call |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
- OWASP IDOR: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References
