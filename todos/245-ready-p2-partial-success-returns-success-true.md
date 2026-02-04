---
status: ready
priority: p2
issue_id: "245"
tags: [code-review, api-design, error-handling, pr-13]
dependencies: []
---

# Batch Operations Return success: true on Partial Failure

## Problem Statement

Batch operations return `{ success: true }` even when some individual operations fail, which is misleading and could cause clients to think all operations succeeded.

## Findings

**Source:** data-integrity-guardian agent

**Location:** `src/routes/client/+page.server.ts` lines 241-276

**Current code:**
```typescript
const results = await Promise.all(updatePromises);
const failCount = results.filter(r => r.error).length;

if (failCount > 0) {
  // Partial success handling
  // ...notifications...
  return { success: true, error: `${failCount} of ${serviceIds.length} failed` };
  //       ^^^^^^^^^^^^^^ Misleading!
}
```

**Impact:**
- Client code may not check for partial failures
- User may think all operations succeeded
- Difficult to retry failed operations

## Proposed Solutions

### Solution 1: Return success: false for Partial Failures (Recommended)
**Pros:** Clear, honest API
**Cons:** May require client code updates
**Effort:** Small
**Risk:** Low

```typescript
return {
  success: false,  // Honest
  partial: true,   // Indicates some worked
  succeeded: successCount,
  failed: failCount,
  failedIds: failedResults.map(r => r.id)
};
```

### Solution 2: Introduce Partial Success Status
**Pros:** More granular
**Cons:** More complex client handling
**Effort:** Medium
**Risk:** Low

```typescript
return {
  status: 'partial',  // 'success' | 'partial' | 'failure'
  succeeded: successCount,
  failed: failCount
};
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/client/+page.server.ts` (batchAcceptSuggestions, batchDeclineSuggestions)
- `src/routes/courier/requests/+page.server.ts` (batchAccept)

## Acceptance Criteria

- [ ] Partial failures clearly indicated in response
- [ ] Client code handles partial failures appropriately
- [ ] User sees accurate feedback about what failed
- [ ] Failed service IDs included for retry capability

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Misleading success response |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
