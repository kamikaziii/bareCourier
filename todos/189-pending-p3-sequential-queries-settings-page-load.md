---
status: pending
priority: p3
issue_id: "189"
tags: [code-review, performance, pr-7]
dependencies: []
---

# Sequential Queries in Settings Page Load

## Problem Statement

The settings page load function makes 4 sequential database queries that could be parallelized with `Promise.all`.

## Findings

**Source:** Performance Oracle Agent

**Location:** `src/routes/courier/settings/+page.server.ts` (lines 84-125)

**Current Code:**
```typescript
// Query 1
const { data: profile } = await supabase.from('profiles')...
// Query 2
const { data: urgencyFees } = await supabase.from('urgency_fees')...
// Query 3
const { data: serviceTypes } = await supabase.from('service_types')...
// Query 4
const { data: distributionZones } = await supabase.from('distribution_zones')...
```

**Impact:**
- 4 sequential round-trips (~80-400ms total)
- Slow settings page load

## Proposed Solutions

### Solution 1: Parallelize with Promise.all (Recommended)
```typescript
const [
    { data: profile },
    { data: urgencyFees },
    { data: serviceTypes },
    { data: distributionZones }
] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('urgency_fees').select('*').order('sort_order'),
    supabase.from('service_types').select('*').order('sort_order'),
    supabase.from('distribution_zones').select('*').order('distrito, concelho')
]);
```
- **Pros:** 60-75% latency reduction
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

## Technical Details

**Affected Files:**
- `src/routes/courier/settings/+page.server.ts`

**Expected Improvement:**
- Current: ~200ms (4 sequential)
- After: ~50ms (parallel)

## Acceptance Criteria

- [ ] All 4 queries run in parallel
- [ ] Same data returned
- [ ] Settings page loads faster

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by performance-oracle agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
