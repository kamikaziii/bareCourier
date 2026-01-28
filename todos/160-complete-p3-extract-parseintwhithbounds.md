---
status: ready
priority: p3
issue_id: "160"
tags: [duplication, refactoring, utilities]
dependencies: []
---

# Extract `parseIntWithBounds` to Shared Utility

## Problem Statement
`parseIntWithBounds()` is defined identically in two separate actions within the same file, creating maintenance burden and violating DRY principle.

## Findings
- Location 1: `src/routes/courier/settings/+page.server.ts:454-459` (updatePastDueSettings action)
- Location 2: `src/routes/courier/settings/+page.server.ts:510-515` (updateClientRescheduleSettings action)
- Both functions are identical
- Used only within this file's actions

## Proposed Solutions

### Option 1: Extract to shared utility (Recommended)
- **Pros**: DRY, reusable if needed elsewhere, cleaner code
- **Cons**: Adds one more file in utils/
- **Effort**: Small
- **Risk**: Low

### Option 2: Move to top of file as module-level helper
- **Pros**: Keeps code in one file, avoids new file
- **Cons**: Less discoverable for other developers
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Create `src/lib/utils/form.ts` with `parseIntWithBounds()` utility. Import it in both actions.

```typescript
// src/lib/utils/form.ts
export function parseIntWithBounds(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
  defaultVal: number
): number {
  if (value === null || value === '') return defaultVal;
  const parsed = parseInt(value as string, 10);
  if (Number.isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
}
```

## Technical Details
- **Affected Files**:
  - `src/routes/courier/settings/+page.server.ts` (refactor both actions)
  - `src/lib/utils/form.ts` (create new)
- **Related Components**: Settings form validation
- **Database Changes**: No

## Resources
- Original finding: Code audit - duplication analysis
- Related issues: None

## Acceptance Criteria
- [ ] New utility created in `src/lib/utils/form.ts`
- [ ] Both actions import and use the utility
- [ ] Duplicate definitions removed from settings page
- [ ] No TypeScript errors
- [ ] Settings form functionality unchanged
- [ ] Code review approved

## Work Log

### 2026-01-28 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

## Notes
Source: Triage session on 2026-01-28
