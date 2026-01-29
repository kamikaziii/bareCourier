---
status: ready
priority: p2
issue_id: "178"
tags: [performance, async, code-review]
dependencies: []
---

# Parallelize Workload Calculations with Promise.all

## Problem Statement

Sequential `await` calls in loop for workload calculations. While design accepted this trade-off, parallelizing is an easy optimization with no behavior change.

## Findings

- **Location:** `src/routes/courier/requests/+page.server.ts:96-99`
- Current sequential code:
  ```typescript
  for (const dateStr of uniqueDates) {
    workloadByDate[dateStr] = await calculateDayWorkload(...);
  }
  ```
- Each iteration waits for previous to complete
- With 5 unique dates @ 50ms each = 250ms sequential vs ~50ms parallel

## Proposed Solutions

### Option 1: Promise.all parallelization (Recommended)
```typescript
const entries = await Promise.all(
  Array.from(uniqueDates).map(async (dateStr) => [
    dateStr,
    await calculateDayWorkload(supabase, user.id, new Date(dateStr + 'T12:00:00'), settings)
  ] as const)
);
const workloadByDate: Record<string, WorkloadEstimate> = Object.fromEntries(entries);
```

- **Pros**: Reduces wall-clock time, no behavior change
- **Cons**: Slightly more complex code
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action

Replace sequential loop with Promise.all for parallel execution.

## Technical Details

- **Affected Files**: `src/routes/courier/requests/+page.server.ts`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] Workload calculations run in parallel
- [ ] Same results as before (no behavior change)
- [ ] Page load time improved
- [ ] Build passes

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Design accepted sequential as trade-off, but parallel is easy win

## Notes

Source: PR #6 code review - easy optimization
