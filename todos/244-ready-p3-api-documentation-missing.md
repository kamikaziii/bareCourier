---
status: ready
priority: p3
issue_id: "244"
tags: [code-review, pr-14, agent-native, documentation]
dependencies: []
---

# API Documentation Missing for send-email Function

## Problem Statement

The send-email edge function has no README or API documentation, making it difficult for developers and agents to understand the endpoint contract without reading the source code.

**Why it matters:**
- Developers must reverse-engineer the API
- Agents cannot discover capabilities programmatically
- No documentation of templates and required fields
- Increases integration friction

## Findings

**Location:** Missing file: `supabase/functions/send-email/README.md`

**What's undocumented:**
- Endpoint URL and method
- Authentication requirements (service role vs user JWT)
- Request body schema
- Available templates and their required data fields
- Response schemas (success, error, skipped)
- Error codes and meanings
- Retry behavior (new in PR #14)

## Proposed Solutions

### Option A: Create README.md (Recommended)
**Pros:** Standard location, version controlled
**Cons:** Manual maintenance
**Effort:** Medium
**Risk:** Very Low

Create `supabase/functions/send-email/README.md`:

```markdown
# send-email Edge Function

Sends email notifications via Resend API with automatic retry for transient failures.

## Endpoint

```
POST /functions/v1/send-email
```

## Authentication

| Method | Header | Use Case |
|--------|--------|----------|
| Service Role | `Authorization: Bearer <service_role_key>` | Internal calls from notify.ts |
| User JWT | `Authorization: Bearer <user_jwt>` | Direct calls from frontend |

## Request

```json
{
  "user_id": "uuid - target user",
  "template": "new_request | delivered | request_accepted | ...",
  "data": {
    "pickup_location": "string",
    "delivery_location": "string",
    "app_url": "string",
    "...template-specific fields"
  }
}
```

## Templates

| Template | Required Fields | Recipient |
|----------|-----------------|-----------|
| new_request | client_name, pickup_location, delivery_location, app_url | Courier |
| delivered | pickup_location, delivery_location, delivered_at, app_url | Client |
| request_accepted | pickup_location, delivery_location, app_url | Client |
| request_rejected | pickup_location, delivery_location, reason?, app_url | Client |
| request_suggested | pickup_location, delivery_location, requested_date, suggested_date, app_url | Client |
| request_cancelled | client_name, pickup_location, delivery_location, app_url | Courier |

## Response

### Success
```json
{
  "success": true,
  "sent": true,
  "email_id": "resend-message-id"
}
```

### Skipped (notifications disabled)
```json
{
  "success": true,
  "sent": false,
  "reason": "Email notifications disabled for user"
}
```

### Error
```json
{
  "error": "Error message"
}
```

## Retry Behavior

- **Retries on:** 429 rate_limit_exceeded, 5xx errors, timeouts
- **Fails fast on:** 429 quota_exceeded, 4xx client errors
- **Max retries:** 3 (4 total attempts)
- **Backoff:** Exponential with jitter (500ms base)
```

### Option B: OpenAPI Spec
**Pros:** Machine-readable, can generate clients
**Cons:** More effort to maintain
**Effort:** Large
**Risk:** Low

## Recommended Action

Implement Option A as a first step. Consider Option B later if API grows.

## Technical Details

- **New file:** `supabase/functions/send-email/README.md`
- **Reference:** Source code lines 60-307 (templates), 517-524 (validation)

## Acceptance Criteria

- [ ] Create README.md with endpoint documentation
- [ ] Document all templates and required fields
- [ ] Document authentication methods
- [ ] Document response schemas
- [ ] Document retry behavior
- [ ] Keep in sync with code changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #14 agent-native review | APIs need documentation for agent consumption |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- Supabase Functions Docs: https://supabase.com/docs/guides/functions
