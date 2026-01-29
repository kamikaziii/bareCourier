---
status: ready
priority: p2
issue_id: "180"
tags: [code-review, performance, pr-7]
dependencies: []
---

# Sequential Database Calls in `calculateTypedPrice`

## Problem Statement

The `calculateTypedPrice` function makes two sequential database queries that are independent and could be parallelized with `Promise.all`.

## Findings

**Source:** Performance Oracle Agent

**Location:** `src/lib/services/type-pricing.ts` (lines 185-206)

**Current Code:**
```typescript
export async function calculateTypedPrice(...) {
    // Call 1: Get service type
    const serviceType = await getServiceType(supabase, input.serviceTypeId);

    // Call 2: Get courier settings
    const settings = await getTypePricingSettings(supabase);

    // ... pricing logic
}
```

**Impact:**
- Two sequential round-trips (~40-200ms total)
- Called during service creation and price preview
- Unnecessary latency for every pricing calculation

## Proposed Solutions

### Solution 1: Parallelize with Promise.all (Recommended)
```typescript
export async function calculateTypedPrice(...) {
    const [serviceType, settings] = await Promise.all([
        getServiceType(supabase, input.serviceTypeId),
        getTypePricingSettings(supabase)
    ]);
    // ...
}
```
- **Pros:** 50% latency reduction, simple fix
- **Cons:** None
- **Effort:** Small (5 min)
- **Risk:** Low

## Technical Details

**Affected Files:**
- `src/lib/services/type-pricing.ts`

**Expected Improvement:**
- Current: ~80-200ms (2 sequential calls)
- After: ~40-100ms (parallel calls)

## Acceptance Criteria

- [ ] Both queries run in parallel
- [ ] Same functionality preserved
- [ ] Price calculation latency reduced

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by performance-oracle agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
