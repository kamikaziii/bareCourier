---
status: ready
priority: p3
issue_id: "059"
tags: [service-worker, dead-code, cleanup]
dependencies: []
---

# GET_SYNC_STATUS Hardcoded to 0 (Dead Code)

## Problem Statement

The `GET_SYNC_STATUS` message handler always responds with `pending: 0`, regardless of actual queue state. Additionally, this message type is never used anywhere in the codebase.

## Findings

**Location:** `src/service-worker.ts:169-172`

**Evidence:**
```typescript
if (event.data && event.data.type === 'GET_SYNC_STATUS') {
  event.ports?.[0]?.postMessage({ pending: 0 });  // Always 0
}
```

**Search Results:**
- `GET_SYNC_STATUS` defined in service worker
- Never called from any client code
- Dead code that returns misleading data

## Proposed Solutions

### Option A: Remove dead code (Recommended)
**Pros:** Less code to maintain
**Cons:** None
**Effort:** Small
**Risk:** Very Low

### Option B: Implement properly
**Pros:** Feature works as intended
**Cons:** Workbox queue state not easily accessible
**Effort:** Medium
**Risk:** Low

## Recommended Action

Option A - Remove the dead code since it's not used.

## Technical Details

**Affected Files:**
- `src/service-worker.ts`

## Acceptance Criteria

- [ ] Dead code removed
- [ ] No functionality lost (never used)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Dead code should be removed |

## Resources

- N/A
