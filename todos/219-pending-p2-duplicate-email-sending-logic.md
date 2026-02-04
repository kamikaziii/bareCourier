---
status: pending
priority: p2
issue_id: "219"
tags: [code-review, code-quality, dry, pr-15]
dependencies: []
---

# P2: Duplicate Email Sending Logic in create-client

## Problem Statement

The invitation email sending code block is copy-pasted twice in `create-client/index.ts`: once for resending invitations (existing unconfirmed users) and once for new users.

**Why it matters:** Bug fixes or changes must be applied in two places, increasing maintenance burden and risk of inconsistency.

## Findings

**Location:** `supabase/functions/create-client/index.ts`
- Lines 147-171 (resend case)
- Lines 215-238 (new user case)

```typescript
// Both blocks do essentially the same thing:
const { data: courierProfile } = await adminClient
  .from("profiles")
  .select("name")
  .eq("id", user.id)
  .single();

const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${supabaseServiceKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    user_id: userId,
    template: "client_invitation",
    data: {
      action_link: linkData.properties.action_link,
      client_name: clientName,
      courier_name: courierProfile?.name || "Your courier",
      app_url: siteUrl
    }
  })
});

if (!emailResponse.ok) {
  return new Response(...);
}
```

**Impact:** ~50 duplicated lines of code.

## Proposed Solutions

### Option A: Extract to helper function (Recommended)
**Pros:** DRY, single point of change for email logic
**Cons:** None
**Effort:** Small (~15 min)
**Risk:** Very Low

```typescript
async function sendInvitationEmail(params: {
  adminClient: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  recipientUserId: string,
  courierUserId: string,
  actionLink: string,
  clientName: string,
  siteUrl: string
}): Promise<{ success: boolean; error?: string }> {
  // Fetch courier name
  const { data: courierProfile } = await params.adminClient
    .from("profiles")
    .select("name")
    .eq("id", params.courierUserId)
    .single();

  const response = await fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.serviceKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: params.recipientUserId,
      template: "client_invitation",
      data: {
        action_link: params.actionLink,
        client_name: params.clientName,
        courier_name: courierProfile?.name || "Your courier",
        app_url: params.siteUrl
      }
    })
  });

  return response.ok
    ? { success: true }
    : { success: false, error: "Failed to send invitation email" };
}
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `supabase/functions/create-client/index.ts`

**Components affected:**
- Invitation email sending (new clients and resend)

**Database changes:** None

## Acceptance Criteria

- [ ] Email sending logic extracted to helper function
- [ ] Both invitation flows (new and resend) use the helper
- [ ] Email content identical to current behavior
- [ ] Tests pass for both flows

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Architecture and Simplicity agents flagged duplication |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
