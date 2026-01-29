---
status: ready
priority: p2
issue_id: "166"
tags: [code-review, performance, pr-5]
dependencies: []
---

# Sequential Database Queries in calculateDayWorkload

## Problem Statement

The `calculateDayWorkload()` function makes two independent database queries sequentially, doubling the latency for workload calculation. These queries can be parallelized for ~40-50% performance improvement.

## Findings

**Location:** `src/lib/services/workload.ts` (lines 68-95)

```typescript
// Query 1: Fetch services for the day
const { data: servicesData } = await supabase
  .from('services')
  .select('*, profiles!client_id(name)')
  .eq('scheduled_date', dateStr)
  ...

// Query 2: Called sequentially (line 95)
const breakTimeMinutes = await getBreakTimeForRange(supabase, courierId, startOfDay, endOfDay);
```

**Impact:** Each status toggle on the dashboard triggers workload recalculation, adding ~100-200ms extra latency due to sequential queries.

## Proposed Solutions

### Option A: Promise.all Parallelization (Recommended)

```typescript
const [servicesResult, breakTimeMinutes] = await Promise.all([
  supabase.from('services')
    .select('*, profiles!client_id(name)')
    .eq('scheduled_date', dateStr)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('scheduled_time_slot'),
  getBreakTimeForRange(supabase, courierId, startOfDay, endOfDay)
]);

const services = (servicesResult.data || []) as ...;
```

**Pros:** Simple change, ~50% latency reduction, no architectural changes
**Cons:** None
**Effort:** Small
**Risk:** Low

### Option B: Single Database Call with View/RPC

Create a database function that returns both services and break time in one call.

**Pros:** Single round-trip
**Cons:** More complex, requires migration, harder to maintain
**Effort:** Medium
**Risk:** Medium

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected files:**
- `src/lib/services/workload.ts`

## Acceptance Criteria

- [ ] Both queries execute in parallel using `Promise.all`
- [ ] Workload calculation latency reduced
- [ ] No functional changes to workload results

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (performance-oracle)

**Actions:**
- Profiled query patterns in workload service
- Identified parallelization opportunity

**Learnings:**
- Independent async operations should always use Promise.all

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
- workload.ts: `src/lib/services/workload.ts:68-95`
