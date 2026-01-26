---
status: ready
priority: p2
issue_id: "056"
tags: [service-worker, offline, architecture]
dependencies: []
---

# Two Incompatible Offline Systems

## Problem Statement

The codebase has two separate offline sync systems that don't communicate:
1. **Service Worker** sends `SYNC_COMPLETE` via postMessage
2. **Offline Store** dispatches `sync-update` CustomEvent

This causes UI desync where OfflineIndicator shows incorrect pending count.

## Findings

**System A - Service Worker:**
- Location: `src/service-worker.ts:41`
- Event: `notifyClients({ type: 'SYNC_COMPLETE', url: entry.request.url })`
- Listener: `src/routes/courier/+page.svelte:252`

**System B - Offline Store:**
- Location: `src/lib/services/offline-store.ts:199, 579`
- Events: `sync-update`, `sync-complete` (CustomEvent)
- Listener: `src/lib/components/OfflineIndicator.svelte:47`

**Problem Scenario:**
1. User makes changes offline
2. Background Sync queues request in service worker
3. OfflineIndicator listens to `sync-update` from IndexedDB
4. Service worker queue not reflected in IndexedDB
5. OfflineIndicator shows 0 pending when there are actually pending syncs

## Proposed Solutions

### Option A: Unify on Service Worker messaging (Recommended)
**Pros:** Single source of truth, simpler
**Cons:** Requires updating OfflineIndicator
**Effort:** Small
**Risk:** Low

Have OfflineIndicator listen to service worker messages instead of CustomEvents.

### Option B: Bridge the two systems
**Pros:** Both systems continue to work
**Cons:** More complexity, two sources of truth
**Effort:** Medium
**Risk:** Medium

### Option C: Remove offline-store.ts, use only service worker
**Pros:** Single system
**Cons:** Loses IndexedDB caching benefits
**Effort:** Large
**Risk:** High

## Recommended Action

Option A - Update OfflineIndicator to listen to service worker messages.

## Technical Details

**Affected Files:**
- `src/lib/components/OfflineIndicator.svelte`
- `src/service-worker.ts` (add pending count to messages)

## Acceptance Criteria

- [ ] OfflineIndicator shows correct pending count from service worker queue
- [ ] Single event system for sync status
- [ ] Remove or deprecate unused event listeners

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Two systems were built independently |

## Resources

- Service Worker postMessage API
