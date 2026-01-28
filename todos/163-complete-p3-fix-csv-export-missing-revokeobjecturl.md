---
status: ready
priority: p3
issue_id: "163"
tags: [memory-leak, csv-export, consistency]
dependencies: []
---

# Fix Missing `URL.revokeObjectURL()` in CSV Exports

## Problem Statement
4 out of 5 CSV export implementations are missing `URL.revokeObjectURL()` cleanup after creating blob URLs. The `client/billing` page implements the correct pattern; the other 4 are inconsistent copies missing cleanup.

## Findings
- **Correct implementation** (reference pattern):
  - `src/routes/client/billing/+page.svelte:146-153` — creates URL, appends link to DOM, clicks, removes link, revokes URL ✅

- **Missing cleanup** (4 files):
  - `src/routes/courier/services/+page.svelte:163` ❌
  - `src/routes/courier/billing/+page.svelte:177` ❌
  - `src/routes/courier/billing/[client_id]/+page.svelte:253` ❌
  - `src/lib/services/insights-data.ts:353` ❌

- All 4 missing files also skip `document.body.appendChild/removeChild` which the correct version uses

## Proposed Solutions

### Option 1: Align all 5 files to the client/billing pattern (Recommended)
- **Pros**: Consistent pattern, proper cleanup, no memory leak
- **Cons**: None
- **Effort**: Small
- **Risk**: Low (same pattern already works in client/billing)

### Option 2: Extract shared CSV download utility
- **Pros**: DRY, single implementation
- **Cons**: Slightly more work, may not be worth abstracting
- **Effort**: Small-Medium
- **Risk**: Low

## Recommended Action
Update 4 files to match the `client/billing` pattern:
```typescript
const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = filename;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
```

## Technical Details
- **Affected Files**:
  - `src/routes/courier/services/+page.svelte`
  - `src/routes/courier/billing/+page.svelte`
  - `src/routes/courier/billing/[client_id]/+page.svelte`
  - `src/lib/services/insights-data.ts`
- **Reference File**: `src/routes/client/billing/+page.svelte` (correct pattern)
- **Database Changes**: No

## Acceptance Criteria
- [ ] All 5 CSV export sites use consistent pattern
- [ ] `URL.revokeObjectURL()` called in all files
- [ ] Link properly appended/removed from DOM
- [ ] CSV downloads still work correctly
- [ ] No TypeScript errors

## Work Log

### 2026-01-28 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Verified inconsistency: 1/5 files correct, 4/5 missing cleanup
- Status: ready

## Notes
Source: Triage session on 2026-01-28
