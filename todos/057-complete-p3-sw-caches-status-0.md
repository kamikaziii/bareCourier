---
status: complete
priority: p3
issue_id: "057"
tags: [service-worker, caching, best-practice]
dependencies: []
---

# CacheableResponsePlugin Overrides Safe Defaults

## Problem Statement

The Workbox CacheableResponsePlugin is configured with `statuses: [0, 200]` which:
1. **Supabase (NetworkFirst):** Redundant - just states the default behavior
2. **Mapbox (CacheFirst):** Overrides the safe default of `[200]` only

This could result in caching opaque error responses indefinitely with CacheFirst strategy.

## Findings

**Location:** `src/service-worker.ts:81-82, 98-99`

**Current Configuration:**
```typescript
// Supabase - NetworkFirst (lines 76-84)
new CacheableResponsePlugin({
  statuses: [0, 200]  // Redundant - NetworkFirst defaults to [0, 200]
})

// Mapbox - CacheFirst (lines 93-101)
new CacheableResponsePlugin({
  statuses: [0, 200]  // Overrides safe default of [200] only
})
```

**Workbox Default Behavior:**
| Strategy | Default Statuses | Reason |
|----------|-----------------|--------|
| NetworkFirst | `[0, 200]` | Network refreshes stale cache |
| CacheFirst | `[200]` only | Cached indefinitely, must be valid |

**What is Status 0?**
- Opaque response from cross-origin without CORS
- Each opaque response takes ~7MB storage (browser padding)
- Cannot distinguish success from error

**Risk Assessment:**
- Mapbox API supports CORS → responses are status 200, not 0
- In normal operation, status 0 won't occur
- BUT: if CORS fails, error would be cached indefinitely with CacheFirst

## Proposed Solutions

### Option A: Remove redundant config, revert to safe defaults (Recommended)
**Pros:** Follows Workbox best practices, removes unnecessary code
**Cons:** None - Mapbox uses CORS properly
**Effort:** Small
**Risk:** Very Low

**For Supabase (NetworkFirst):**
```typescript
// Remove CacheableResponsePlugin entirely - uses default [0, 200]
new NetworkFirst({
  cacheName: 'supabase-data',
  networkTimeoutSeconds: 10,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 60 * 60 * 24
    })
    // CacheableResponsePlugin removed - defaults to [0, 200]
  ]
})
```

**For Mapbox (CacheFirst):**
```typescript
// Remove CacheableResponsePlugin entirely - defaults to [200] only
new CacheFirst({
  cacheName: 'mapbox-tiles',
  plugins: [
    new ExpirationPlugin({
      maxEntries: 500,
      maxAgeSeconds: 60 * 60 * 24 * 30
    })
    // CacheableResponsePlugin removed - defaults to [200] only (safe)
  ]
})
```

### Option B: Keep but add purgeOnQuotaError
**Pros:** Safety net if opaque responses balloon storage
**Cons:** Still allows caching errors
**Effort:** Small
**Risk:** Low

## Recommended Action

**Option A** - Remove CacheableResponsePlugin from both routes:
1. Supabase: Redundant (just states default)
2. Mapbox: Reverts to safe default `[200]` only

This follows Chrome DevRel best practices: "CacheFirst only considers responses with status 200 as cacheable by default because it relies on indefinite reuse."

## Technical Details

**Affected Files:**
- `src/service-worker.ts`

**Changes:**
1. Remove lines 81-83 (Supabase CacheableResponsePlugin)
2. Remove lines 98-100 (Mapbox CacheableResponsePlugin)

## Acceptance Criteria

- [x] CacheableResponsePlugin removed from Supabase route
- [x] CacheableResponsePlugin removed from Mapbox route
- [x] Supabase still uses NetworkFirst with default [0, 200]
- [x] Mapbox uses CacheFirst with default [200] only
- [x] Build succeeds
- [ ] Maps still load correctly (manual verification required)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Status 0 can pollute cache |
| 2026-01-26 | Deep research on Workbox best practices | NetworkFirst defaults to [0,200], CacheFirst defaults to [200]. Mapbox uses CORS so status 0 unlikely. |
| 2026-01-26 | Implemented fix: Removed CacheableResponsePlugin from both routes and removed unused import | Workbox strategies use safe defaults out of the box |

## Resources

- [Workbox CacheableResponsePlugin](https://developer.chrome.com/docs/workbox/modules/workbox-cacheable-response)
- [When 7KB Equals 7MB](https://cloudfour.com/thinks/when-7-kb-equals-7-mb/) - opaque response storage padding
- [Handling Opaque Responses](https://whatwebcando.today/articles/opaque-responses-service-worker/)
