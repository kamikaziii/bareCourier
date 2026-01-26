---
status: ready
priority: p3
issue_id: "061"
tags: [offline, ux, bug]
dependencies: ["056"]
---

# OfflineIndicator Uses Fake setTimeout Instead of Real Sync Status

## Problem Statement

The OfflineIndicator component shows "synced" after a hardcoded 1.5s timeout instead of listening to actual sync completion events. This is misleading UX.

## Findings

**Location:** `src/lib/components/OfflineIndicator.svelte:25-31`

**Evidence:**
```typescript
function handleOnline() {
  isOnline = true;
  if (pendingCount > 0) {
    isSyncing = true;
    // Fake timeout - not real sync
    setTimeout(() => {
      isSyncing = false;
      showSyncComplete = true;
      setTimeout(() => {
        showSyncComplete = false;
      }, 2000);
    }, 1500);  // Hardcoded 1.5s
  }
}
```

**Problem Scenario:**
1. User comes online with pending changes
2. Component shows "Syncing..." for 1.5s
3. Component shows "Synced!"
4. But actual sync might still be running (or failed!)
5. User thinks data is saved when it might not be

## Proposed Solutions

### Option A: Listen to service worker SYNC_COMPLETE (Recommended)
**Pros:** Real sync status
**Cons:** Requires service worker integration
**Effort:** Small
**Risk:** Low

### Option B: Remove fake feedback entirely
**Pros:** No misleading info
**Cons:** Less feedback to user
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A - Listen to service worker messages for real sync status.

## Technical Details

**Affected Files:**
- `src/lib/components/OfflineIndicator.svelte`

**Dependencies:** Should be done after #056 (unify event systems)

## Acceptance Criteria

- [ ] Remove hardcoded setTimeout
- [ ] Listen to service worker sync events
- [ ] Show real sync completion status
- [ ] Handle sync failures

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Fake progress is misleading |

## Resources

- Service Worker postMessage API
