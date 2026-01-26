---
status: complete
priority: p2
issue_id: "055"
tags: [service-worker, offline, feature-gap]
dependencies: []
---

# POST/DELETE Requests Have No Offline Support

## Problem Statement

The service worker only handles PATCH requests with Background Sync. POST (service creation) and DELETE requests have no offline support, meaning users cannot create or delete services while offline.

## Findings

**Location:** `src/service-worker.ts:58-68`

**Evidence:**
```typescript
// Only PATCH is handled with Background Sync
registerRoute(
  ({ url, request }) =>
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/rest/') &&
    url.pathname.includes('/services') &&
    request.method === 'PATCH',  // Only PATCH
  new NetworkOnly({
    plugins: [statusSyncPlugin]
  }),
  'PATCH'
);
```

**Problem Scenario:**
1. Courier goes offline
2. Tries to create new service via form
3. Request fails immediately (no offline queue)
4. User sees error, data lost
5. Must manually re-enter when online

**Contrast with existing offline-store.ts:**
- `offline-store.ts` supports `'update' | 'create' | 'delete'` mutations
- But Background Sync Plugin only queues PATCH

## Proposed Solutions

### Option A: Add POST/DELETE routes with Background Sync
**Pros:** Full offline support
**Cons:** More complex sync logic, conflict resolution needed
**Effort:** Medium
**Risk:** Medium

### Option B: Integrate with existing offline-store.ts
**Pros:** Reuses existing IndexedDB infrastructure
**Cons:** Two systems need coordination
**Effort:** Medium
**Risk:** Medium

### Option C: Document limitation, defer implementation
**Pros:** No code changes now
**Cons:** Users still can't create/delete offline
**Effort:** None
**Risk:** None (but UX limitation remains)

## Recommended Action

Start with Option A for POST requests (most common offline action), then iterate.

## Technical Details

**Affected Files:**
- `src/service-worker.ts`
- Possibly `src/lib/services/offline-store.ts` for coordination

## Acceptance Criteria

- [x] POST requests to /services queued when offline
- [x] Queued POSTs sync when online
- [x] User notified of pending creations (via existing SYNC_COMPLETE message)
- [ ] Consider DELETE in follow-up (deferred to separate todo)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Offline support was incomplete |
| 2026-01-26 | Added POST route with Background Sync | Reused statusSyncPlugin for consistency |

## Resources

- Workbox Background Sync documentation
