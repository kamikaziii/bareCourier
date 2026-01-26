---
status: ready
priority: p2
issue_id: "057"
tags: [service-worker, caching, bug]
dependencies: []
---

# CacheableResponsePlugin Caches Status 0 (Errors)

## Problem Statement

The Workbox CacheableResponsePlugin is configured to cache responses with status `[0, 200]`. Status 0 represents failed/offline requests, which could result in caching error responses.

## Findings

**Location:** `src/service-worker.ts:81-82, 98-99`

**Evidence:**
```typescript
new CacheableResponsePlugin({
  statuses: [0, 200]  // Status 0 = failed/offline request
})
```

**What is Status 0?**
- Request fails network (offline)
- CORS error
- Request aborted

**Problem Scenario:**
1. User requests data while offline
2. Request returns opaque response (status 0)
3. Response gets cached
4. User comes online
5. Subsequent requests return cached "error" response
6. User sees stale/broken data

## Proposed Solutions

### Option A: Remove status 0 from cacheable statuses (Recommended)
**Pros:** Only successful responses cached
**Cons:** None
**Effort:** Small
**Risk:** Very Low

```typescript
new CacheableResponsePlugin({
  statuses: [200]  // Only cache successful responses
})
```

### Option B: Add status 0 only for specific routes
**Pros:** Flexibility for CORS requests
**Cons:** More complex
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A - Change to `statuses: [200]` for both Supabase and Mapbox routes.

## Technical Details

**Affected Files:**
- `src/service-worker.ts`

**Lines to change:**
- Line 81-82 (Supabase REST API)
- Line 98-99 (Mapbox tiles)

## Acceptance Criteria

- [ ] Only status 200 responses are cached
- [ ] Failed requests not cached
- [ ] Retries work correctly when online

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Status 0 can pollute cache |

## Resources

- Workbox CacheableResponsePlugin documentation
