---
status: complete
priority: p3
issue_id: "182"
tags: [refactoring, dry, code-review, optional]
dependencies: []
---

# Extract Status Styles to Shared Utility (Optional)

## Problem Statement

Both WorkloadCard.svelte and WorkloadSummary.svelte have identical status-to-style mapping logic duplicated. While acceptable for 2 components, extracting to shared utility improves maintainability.

## Findings

- **Location:**
  - `src/lib/components/WorkloadCard.svelte:22-35`
  - `src/lib/components/WorkloadSummary.svelte:21-35`
- Duplicated code:
  ```typescript
  const statusBg = $derived(
    workload.status === 'comfortable' ? 'bg-green-50...' : ...
  );
  const statusColor = $derived(
    workload.status === 'comfortable' ? 'text-green-600' : ...
  );
  ```
- Same ternary chain repeated for bg, color, icon selection
- Change in one must be mirrored in other

## Proposed Solutions

### Option 1: Extract to shared utility (Recommended)

Create `src/lib/services/workload-styles.ts`:
```typescript
import { CheckCircle, Clock, AlertTriangle } from '@lucide/svelte';
import type { WorkloadEstimate } from './workload.js';

export const WORKLOAD_STYLES = {
  comfortable: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-600',
    icon: CheckCircle
  },
  tight: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    text: 'text-yellow-600',
    icon: Clock
  },
  overloaded: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-600',
    icon: AlertTriangle
  }
} as const;

export function getWorkloadStyles(status: WorkloadEstimate['status']) {
  return WORKLOAD_STYLES[status];
}
```

- **Pros**: DRY, single source of truth, easy to maintain
- **Cons**: New file, import overhead
- **Effort**: Small (20 minutes)
- **Risk**: Low

### Option 2: Keep duplicated
- **Pros**: Components self-contained
- **Cons**: Maintenance burden, drift risk
- **Effort**: None
- **Risk**: Low-Medium over time

## Recommended Action

Extract to shared utility. Optional if deemed over-engineering for 2 components.

## Technical Details

- **Affected Files**:
  - Create `src/lib/services/workload-styles.ts`
  - Update `src/lib/components/WorkloadCard.svelte`
  - Update `src/lib/components/WorkloadSummary.svelte`
- **Related Components**: WorkloadCard, WorkloadSummary
- **Database Changes**: No

## Acceptance Criteria

- [ ] Shared utility created
- [ ] Both components use shared styles
- [ ] No visual changes
- [ ] Build passes

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Marked as optional

## Notes

Source: PR #6 code review - DRY improvement (optional)
