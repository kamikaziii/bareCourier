---
status: complete
priority: p3
issue_id: "061"
tags: [offline, ux, bug]
dependencies: ["056"]
---

# OfflineIndicator Uses Fake setTimeout Instead of Real Sync Status

## Problem Statement

The OfflineIndicator component shows "synced" after a hardcoded 1.5s timeout instead of listening to actual sync completion events. This is misleading UX.

## Solution Implemented

The fake setTimeout in handleOnline() was already removed in #056 when the service worker message listener was added. This PR completes the work by adding proper handling for sync failures.

**Changes Made:**
1. Verified `handleOnline()` no longer has fake setTimeout (already fixed in #056)
2. Added `showSyncFailed` state variable for failure indication
3. Added handler for `SYNC_FAILED_PERMANENT` service worker messages
4. Added visual feedback (red banner with AlertTriangle icon) for sync failures
5. Added i18n message keys for both EN and PT-PT locales
6. Updated visibility logic to show banner during failure state

**Files Modified:**
- `src/lib/components/OfflineIndicator.svelte` - Added failure handling and UI
- `messages/en.json` - Added `offline_sync_failed` message
- `messages/pt-PT.json` - Added `offline_sync_failed` message

## Acceptance Criteria

- [x] Remove hardcoded setTimeout (already done in #056)
- [x] Listen to service worker sync events (SYNC_COMPLETE, SYNC_QUEUED, SYNC_STATUS)
- [x] Show real sync completion status
- [x] Handle sync failures (SYNC_FAILED_PERMANENT)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Fake progress is misleading |
| 2026-01-26 | Resolved - added SYNC_FAILED_PERMANENT handler and UI | Service worker already sends failure messages |

## Resources

- Service Worker postMessage API
