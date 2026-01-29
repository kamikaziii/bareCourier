---
status: pending
priority: p3
issue_id: "186"
tags: [code-review, agent-native, api, pr-7]
dependencies: []
---

# Missing Error Codes in Responses

## Problem Statement

Error responses use generic messages or translation keys but lack structured error codes. This makes it difficult for programmatic consumers to distinguish between error types.

## Findings

**Source:** Agent-Native Reviewer Agent

**Current Error Pattern:**
```typescript
return fail(500, { error: 'Failed to create service type' });
return fail(409, { error: 'service_type_in_use' });
```

**Impact:**
- Agents can't programmatically distinguish error types
- No structured retry logic possible
- Hard to provide intelligent error handling

## Proposed Solutions

### Solution 1: Add structured error codes (Recommended)
```typescript
return fail(409, {
  error: 'service_type_in_use',
  code: 'CONFLICT_IN_USE',
  details: { usageCount: count }
});
```
- **Pros:** Machine-readable errors, better debugging
- **Cons:** Slightly more verbose
- **Effort:** Small
- **Risk:** Low

## Technical Details

**Affected Files:**
- `src/routes/courier/settings/+page.server.ts`
- All action handlers

## Acceptance Criteria

- [ ] All errors include a `code` field
- [ ] Error codes are documented
- [ ] Backwards compatible with existing error handling

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by agent-native-reviewer agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
