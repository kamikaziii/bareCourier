---
status: ready
priority: p3
issue_id: "238"
tags: [code-review, pr-15, cache, memory]
dependencies: []
---

# Module-Level Cache No Size Limit

## Problem Statement

The `clientStatusCache` Map at module level in the client detail page grows unboundedly as the courier navigates to different client pages. In a scenario where a courier has many clients, this could lead to memory issues over long browser sessions.

## Findings

**Location:** `src/routes/courier/clients/[id]/+page.svelte:1-8`

```typescript
// Module-level cache for client status data
const clientStatusCache = new Map<string, {
  data: ClientStatusData;
  timestamp: number;
}>();
```

Issues:
1. No maximum size limit on the Map
2. No LRU (Least Recently Used) eviction policy
3. Entries only expire based on TTL (5 minutes), not count
4. In long browser sessions, memory can grow if courier views many clients

## Proposed Solution

Implement a simple LRU cache with size limit:

```typescript
const CACHE_MAX_SIZE = 100;

function setCache(clientId: string, data: ClientStatusData) {
  // Evict oldest entries if at capacity
  if (clientStatusCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = clientStatusCache.keys().next().value;
    if (oldestKey) clientStatusCache.delete(oldestKey);
  }
  clientStatusCache.set(clientId, {
    data,
    timestamp: Date.now()
  });
}
```

Alternatively, consider using a library like `lru-cache` or implementing a simple LRU wrapper.

## Acceptance Criteria

- [ ] Cache has a maximum size limit (suggested: 100 entries)
- [ ] Oldest entries are evicted when limit is reached
- [ ] TTL-based expiration still works alongside size limit
- [ ] No memory growth issues in long sessions

## Work Log

| Date | Action | Details |
|------|--------|---------|
| 2026-02-04 | Created | PR #15 code review finding |
