---
status: pending
priority: p3
issue_id: "184"
tags: [code-review, validation, security, pr-7]
dependencies: []
---

# Missing UUID Validation on Form Inputs

> **Note:** Downgraded from P2 to P3. Supabase will reject invalid UUIDs at the database level. This is defense-in-depth rather than critical security.

## Problem Statement

Several form handlers accept UUIDs (`id`, `service_type_id`, `client_id`) directly from form data without validating that they are properly formatted UUIDs.

## Findings

**Source:** Security Sentinel Agent

**Locations:**
- `src/routes/courier/settings/+page.server.ts` (lines 773, 811, 845)
- `src/routes/courier/services/new/+page.server.ts` (lines 86, 108)

**Current Code:**
```typescript
const id = formData.get('id') as string;
// No validation before use
```

**Impact:**
- Invalid UUIDs cause database errors
- Poor error messages for users
- Unnecessary database round-trips

## Proposed Solutions

### Solution 1: Add UUID validation helper (Recommended)
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(value: string | null, fieldName: string) {
  if (!value || !UUID_REGEX.test(value)) {
    return fail(400, { error: `Invalid ${fieldName} format` });
  }
  return null;
}
```
- **Pros:** Better error messages, defense in depth
- **Cons:** Minor code addition
- **Effort:** Small
- **Risk:** Low

## Technical Details

**Affected Files:**
- `src/routes/courier/settings/+page.server.ts`
- `src/routes/courier/services/new/+page.server.ts`
- Potentially: `src/lib/utils/validation.ts` (new utility)

## Acceptance Criteria

- [ ] UUID format validated before database operations
- [ ] Clear error messages for invalid UUIDs
- [ ] No change to valid request handling

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by security-sentinel agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
