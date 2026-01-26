---
status: complete
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

### Option A: Collect failures, re-queue after loop, throw at end (IMPLEMENTED)
**Pros:** All requests get attempted, proper Workbox retry scheduling
**Cons:** Slightly more complex
**Effort:** Small
**Risk:** Low

**IMPORTANT:** Using `continue` after `unshiftRequest` causes an INFINITE LOOP because `shiftRequest` takes from the front and `unshiftRequest` adds to the front, so the same failing item is immediately re-processed.

```typescript
const failedEntries: typeof entry[] = [];

while ((entry = await queue.shiftRequest())) {
  try {
    const response = await fetch(entry.request.clone());
    if (!response.ok) {
      failedEntries.push(entry);  // Save for later, don't re-queue yet
      continue;
    }
    notifyClients({ type: 'SYNC_COMPLETE', url: entry.request.url });
  } catch (error) {
    failedEntries.push(entry);  // Save for later
    continue;
  }
}

// Re-queue failed entries AFTER processing all
for (const failed of failedEntries) {
  await queue.unshiftRequest(failed);
}

// Throw to signal Workbox to schedule retry with exponential backoff
if (failedEntries.length > 0) {
  throw new Error('Some requests failed');
}
```

### Option B: Use Workbox's default behavior
**Pros:** Less custom code
**Cons:** May lose some control
**Effort:** Small
**Risk:** Low

Remove custom `onSync` handler and let Workbox handle retries natively.

## Recommended Action

Option A - Collect failures, process all items, re-queue failures after loop, throw at end to trigger Workbox retry scheduling.

## Technical Details

**Affected Files:**
- `src/service-worker.ts`

## Acceptance Criteria

- [x] All queued requests attempted during sync event
- [x] Failed requests re-queued without breaking loop
- [x] Successful requests notify clients
- [x] Error logging preserved

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | throw in loop breaks all processing |
| 2026-01-26 | Initial fix with continue+unshiftRequest | WRONG - caused infinite loop |
| 2026-01-26 | Corrected fix: collect failures, re-queue after loop, throw at end | shiftRequest takes from front, unshiftRequest adds to front = infinite loop if done inline |

## Resources

- Workbox Background Sync documentation
