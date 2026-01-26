---
status: ready
priority: p2
issue_id: "058"
tags: [service-worker, background-sync, error-handling]
dependencies: ["054"]
---

# No Permanent Failure Handling for Background Sync

## Problem Statement

Failed sync requests are re-queued indefinitely without detecting permanent failures. After `maxRetentionTime` (24 hours), requests are silently dropped with no user notification.

## Findings

**Location:** `src/service-worker.ts:43-45`

**Evidence:**
```typescript
catch (error) {
  await queue.unshiftRequest(entry);
  throw error;  // Will retry until maxRetentionTime (24 hours)
}
```

**Scenarios with no recovery:**
- 401 Unauthorized (user logged out) → Retries for 24h, then dropped
- 403 Forbidden (permission lost) → Retries for 24h, then dropped
- 400 Bad Request (malformed data) → Retries for 24h, then dropped

**Problem:** User is never notified when their changes are permanently lost.

## Proposed Solutions

### Option A: Detect permanent failures and notify user (Recommended)
**Pros:** User knows their data was lost
**Cons:** More complex error handling
**Effort:** Medium
**Risk:** Low

```typescript
if (response.status === 401 || response.status === 403 || response.status === 400) {
  // Permanent failure - don't retry
  notifyClients({
    type: 'SYNC_FAILED_PERMANENT',
    url: entry.request.url,
    status: response.status
  });
  continue; // Don't re-queue
}
```

### Option B: Limit retry attempts
**Pros:** Simpler than status detection
**Cons:** May drop recoverable errors
**Effort:** Small
**Risk:** Medium

## Recommended Action

Option A - Detect 4xx errors as permanent and notify user.

## Technical Details

**Affected Files:**
- `src/service-worker.ts`
- Client-side listener for `SYNC_FAILED_PERMANENT` message

## Acceptance Criteria

- [ ] 4xx errors not retried indefinitely
- [ ] User notified of permanent sync failures
- [ ] 5xx errors still retry (temporary)
- [ ] Network errors still retry (temporary)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Silent data loss is bad UX |

## Resources

- HTTP status code semantics
