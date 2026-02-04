---
status: ready
priority: p3
issue_id: "245"
tags: [code-review, pr-14, agent-native, validation]
dependencies: []
---

# Template Field Validation Missing

## Problem Statement

The send-email function accepts template data without validating that required fields are present for the specified template. Missing fields result in empty placeholders in sent emails rather than validation errors.

**Why it matters:**
- Emails sent with empty placeholders look unprofessional
- No feedback to caller about missing data
- Agents cannot know if request was valid
- Silent failures are hard to debug

## Findings

**Location:** `supabase/functions/send-email/index.ts:517`

**Current code:**
```typescript
const { user_id, template, data: templateData } = await req.json() as EmailData & { user_id: string };

if (!user_id || !template) {
  return new Response(
    JSON.stringify({ error: "user_id and template are required" }),
    { status: 400, ... }
  );
}

// No validation of templateData fields!
```

**Impact example:**
```json
// Request missing required field
{
  "user_id": "...",
  "template": "delivered",
  "data": {
    "pickup_location": "123 Main St"
    // Missing: delivery_location, delivered_at, app_url
  }
}

// Email is sent with empty values - no error returned!
```

## Proposed Solutions

### Option A: Add Template Field Validation (Recommended)
**Pros:** Clear errors, prevents bad emails
**Cons:** More code to maintain
**Effort:** Medium
**Risk:** Low

```typescript
const TEMPLATE_REQUIRED_FIELDS: Record<EmailTemplate, string[]> = {
  new_request: ["client_name", "pickup_location", "delivery_location", "app_url"],
  delivered: ["pickup_location", "delivery_location", "delivered_at", "app_url"],
  request_accepted: ["pickup_location", "delivery_location", "app_url"],
  request_rejected: ["pickup_location", "delivery_location", "app_url"],
  request_suggested: ["pickup_location", "delivery_location", "requested_date", "suggested_date", "app_url"],
  request_cancelled: ["client_name", "pickup_location", "delivery_location", "app_url"],
};

// After template validation:
const requiredFields = TEMPLATE_REQUIRED_FIELDS[template];
const missingFields = requiredFields?.filter(f => !templateData?.[f]);

if (missingFields?.length) {
  return new Response(
    JSON.stringify({
      error: `Missing required fields for ${template}: ${missingFields.join(", ")}`
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Option B: Warn But Send Anyway
**Pros:** Backward compatible, doesn't block
**Cons:** Still sends bad emails
**Effort:** Small
**Risk:** Very Low

```typescript
const missingFields = requiredFields?.filter(f => !templateData?.[f]);
if (missingFields?.length) {
  console.warn(`[send-email] Missing fields for ${template}: ${missingFields.join(", ")}`);
}
// Continue sending...
```

## Recommended Action

Implement Option A to fail fast on invalid requests.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Insert after:** Line 524 (template validation)
- **Reference:** Template definitions at lines 246-428

## Acceptance Criteria

- [ ] Define required fields for each template
- [ ] Validate templateData has all required fields
- [ ] Return 400 with clear error message listing missing fields
- [ ] Add tests for validation
- [ ] Update API documentation (#244)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #14 agent-native review | Validate early, fail fast |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
