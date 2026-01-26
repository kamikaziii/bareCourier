---
status: ready
priority: p1
issue_id: "054"
tags: [service-worker, background-sync, bug]
dependencies: []
---

# Background Sync Loop Breaks on First Error

## Problem Statement

The background sync retry logic has a flow control issue. When a request fails, the `throw` statement breaks the `while` loop, causing subsequent queued requests to be skipped until the next sync event (which could be hours later).

## Findings

**Location:** `src/service-worker.ts:32-48`

**Evidence:**
```typescript
while ((entry = await queue.shiftRequest())) {
  try {
    const response = await fetch(entry.request.clone());
    if (!response.ok) {
      await queue.unshiftRequest(entry);
      throw new Error(...);  // BREAKS THE LOOP
    }
  } catch (error) {
    await queue.unshiftRequest(entry);
    throw error;  // BREAKS THE LOOP - remaining items not processed
  }
}
```

**Problem Scenario:**
1. User makes 5 PATCH requests offline
2. Device comes online, sync triggered
3. Request #1 fails with 500 status
4. Loop breaks due to throw
5. Requests #2-5 remain in queue
6. User waits hours for next sync event

## Proposed Solutions

### Option A: Continue loop on error, track failures (Recommended)
**Pros:** All requests get attempted, better UX
**Cons:** Slightly more complex
**Effort:** Small
**Risk:** Low

```typescript
while ((entry = await queue.shiftRequest())) {
  try {
    const response = await fetch(entry.request.clone());
    if (!response.ok) {
      await queue.unshiftRequest(entry);
      continue; // Don't break - try next request
    }
    notifyClients({ type: 'SYNC_COMPLETE', url: entry.request.url });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    await queue.unshiftRequest(entry);
    continue; // Don't break - try next request
  }
}
```

### Option B: Use Workbox's default behavior
**Pros:** Less custom code
**Cons:** May lose some control
**Effort:** Small
**Risk:** Low

Remove custom `onSync` handler and let Workbox handle retries natively.

## Recommended Action

Option A - Continue loop on error so all queued requests get attempted.

## Technical Details

**Affected Files:**
- `src/service-worker.ts`

## Acceptance Criteria

- [ ] All queued requests attempted during sync event
- [ ] Failed requests re-queued without breaking loop
- [ ] Successful requests notify clients
- [ ] Error logging preserved

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | throw in loop breaks all processing |

## Resources

- Workbox Background Sync documentation
