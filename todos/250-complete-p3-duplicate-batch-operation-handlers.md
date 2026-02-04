---
status: ready
priority: p3
issue_id: "250"
tags: [code-review, code-quality, dry, pr-13]
dependencies: []
---

# Duplicate Batch Operation Handlers

## Problem Statement

`batchAcceptSuggestions` and `batchDeclineSuggestions` share ~90% identical code structure with only minor differences in the update fields and notification template.

## Findings

**Source:** code-simplicity-reviewer agent

**Location:** `src/routes/client/+page.server.ts` lines 171-428

**Duplicated structure:**
1. Auth check (14 lines - identical)
2. JSON parsing with error handling (7 lines - identical)
3. Batch size validation (6 lines - identical)
4. Ownership verification query (10 lines - nearly identical)
5. Update loop (15 lines - similar structure)
6. Notification call (20 lines - different template only)

**Differences:**
- Update fields: `accepted` vs `pending`
- Email template: `suggestion_accepted` vs `suggestion_declined`
- One extra field in decline (`original_date`)

**Impact:**
- ~80 lines of duplicated code
- Bug fixes need to be applied twice
- Inconsistency risk

## Proposed Solutions

### Solution 1: Generic Batch Handler Factory (Recommended)
**Pros:** Maximum code reuse, single maintenance point
**Cons:** More abstract
**Effort:** Medium
**Risk:** Low

```typescript
function createBatchSuggestionHandler(config: {
  action: 'accept' | 'decline';
  updateFields: (svc: Service) => Record<string, unknown>;
  notification: {
    title: string;
    template: string;
    message: (count: number) => string;
  };
}) {
  return async ({ request, locals }) => {
    // Shared implementation
  };
}

export const actions = {
  batchAcceptSuggestions: createBatchSuggestionHandler({
    action: 'accept',
    updateFields: (svc) => ({
      request_status: 'accepted',
      scheduled_date: svc.suggested_date,
      // ...
    }),
    notification: {
      title: 'Sugestões Aceites',
      template: 'suggestion_accepted',
      message: (n) => `O cliente aceitou ${n} sugestão(ões).`
    }
  }),
  // ...
};
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/client/+page.server.ts`

**Estimated LOC Reduction:** 80-100 lines

## Acceptance Criteria

- [ ] Single implementation for shared logic
- [ ] Clear configuration for differences
- [ ] Both actions work identically to before
- [ ] Test coverage maintained

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Near-duplicate handlers |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
