---
status: pending
priority: p2
issue_id: "244"
tags: [code-review, performance, edge-function, pr-13]
dependencies: []
---

# Sequential Loop in check-past-due Edge Function

## Problem Statement

The `check-past-due` edge function processes services sequentially with blocking awaits for each notification dispatch. This creates a performance bottleneck that could cause function timeouts at scale.

## Findings

**Source:** performance-oracle agent

**Location:** `supabase/functions/check-past-due/index.ts` lines 215-273

**Current code:**
```typescript
for (const { service, overdueMinutes } of pastDueServices) {
    // ... claim logic ...
    const { data: claimedRows } = await claimQuery.select('id');  // Blocking
    // ...
    await dispatchNotification({...});  // Blocking
    notifiedCount++;
}
```

**Impact:**
- Each service requires ~3-6 sequential operations
- 50 services = ~150+ sequential operations = 15-30 seconds
- Risk of edge function timeout (default 60s)
- Poor scalability

## Proposed Solutions

### Solution 1: Parallelize Dispatch After Claim (Recommended)
**Pros:** Significant speedup, maintains atomic claim
**Cons:** Slightly more complex
**Effort:** Medium
**Risk:** Low

```typescript
// Claim first (sequential is fine for atomicity)
const claimedServices = [];
for (const { service, overdueMinutes } of pastDueServices) {
    const claimed = await attemptClaim(service);
    if (claimed) claimedServices.push({ service, overdueMinutes });
}

// Dispatch in parallel batches
const BATCH_SIZE = 5;
for (let i = 0; i < claimedServices.length; i += BATCH_SIZE) {
    const batch = claimedServices.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(s => dispatchNotification({...})));
}
```

### Solution 2: Full Parallelization
**Pros:** Maximum speed
**Cons:** May overwhelm system
**Effort:** Medium
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/functions/check-past-due/index.ts`

**Performance Projections:**
| Services | Current | Optimized |
|----------|---------|-----------|
| 10 | ~5s | ~2s |
| 50 | ~25s | ~8s |
| 100 | ~50s (timeout risk) | ~15s |

## Acceptance Criteria

- [ ] Dispatch operations parallelized
- [ ] Claim atomicity preserved
- [ ] Function completes within timeout for 100+ services
- [ ] No duplicate notifications

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Sequential processing limits scalability |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
