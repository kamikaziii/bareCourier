---
status: pending
priority: p3
issue_id: "225"
tags: [code-review, typescript, api-design, pr-15]
dependencies: []
---

# P3: Missing Typed Response Interfaces for Edge Functions

## Problem Statement

Edge function responses are ad-hoc JSON without shared TypeScript interfaces. This makes it harder for agents and external consumers to work with the APIs programmatically.

**Why it matters:** Agents and automated tools must infer response types from documentation or source code instead of having a defined contract.

## Findings

**Response shapes (inferred from code):**

```typescript
// create-client success
{
  success: true,
  user: { id: string, email: string },
  invitation_sent: boolean,
  resend?: boolean
}

// create-client partial success (207)
{
  error: string,
  user: { id: string, email: string },
  invitation_sent: boolean
}

// check-client-status success
{
  client_id: string,
  email: string,
  email_confirmed_at: string | null,
  is_confirmed: boolean,
  created_at: string
}
```

## Proposed Solutions

### Option A: Create shared API types (Recommended)
**Pros:** Type safety, documentation, better DX
**Cons:** Maintenance of types
**Effort:** Medium
**Risk:** None

```typescript
// supabase/functions/_shared/api-types.ts

export interface CreateClientRequest {
  email: string;
  name: string;
  password?: string;
  send_invitation?: boolean;
  phone?: string;
  default_pickup_location?: string;
  default_pickup_lat?: number;
  default_pickup_lng?: number;
  default_service_type_id?: string;
}

export interface CreateClientResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
  } | null;
  invitation_sent: boolean;
  resend?: boolean;
  error?: string;
}

export interface CheckClientStatusRequest {
  client_id: string;
}

export interface CheckClientStatusResponse {
  client_id: string;
  email: string;
  email_confirmed_at: string | null;
  is_confirmed: boolean;
  created_at: string;
}
```

### Option B: Generate OpenAPI spec
**Pros:** Industry standard, tooling support
**Cons:** More complex setup
**Effort:** Large
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `supabase/functions/_shared/api-types.ts` (new)
- `supabase/functions/create-client/index.ts`
- `supabase/functions/check-client-status/index.ts`

## Acceptance Criteria

- [ ] Shared types defined in `_shared/api-types.ts`
- [ ] Edge functions use typed responses
- [ ] Frontend can import types if needed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Agent-native reviewer flagged API contract gaps |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
