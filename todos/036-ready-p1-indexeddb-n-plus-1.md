# IndexedDB N+1 Transaction Problem

---
status: ready
priority: p1
issue_id: "036"
tags: [performance, indexeddb, offline]
dependencies: []
---

**Priority**: P1 (Critical)
**File**: `src/lib/services/offline-store.ts:40-41, 54-57`
**Source**: performance-oracle code review

## Issue 1: cacheServices() N+1 writes

```typescript
// Current: N separate transactions
await Promise.all(services.map(s => set(s.id, s)));
```

At 1000+ services, this creates massive transaction overhead.

## Issue 2: getAllCachedServices() N+1 reads

```typescript
// Current: 1 + N calls
const allKeys = await keys();
const allServices = await Promise.all(allKeys.map(get));
```

## Fix

Use `idb-keyval` batch operations:

```typescript
import { setMany, entries } from 'idb-keyval';

// Batch write
await setMany(services.map(s => [s.id, s]));

// Single pass read
const allEntries = await entries();
const services = allEntries.map(([_, value]) => value);
```

## Verification

1. Test with 500+ services
2. Measure transaction time before/after
3. Should see 10x+ improvement

## Acceptance Criteria

- [ ] cacheServices uses setMany for batch writes
- [ ] getAllCachedServices uses entries for single-pass read
- [ ] Performance test shows improvement

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by performance-oracle agent | idb-keyval has batch operations |
| 2026-01-24 | Approved during triage | Status changed to ready |
