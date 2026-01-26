---
status: complete
priority: p3
issue_id: "052"
tags: [code-review, code-quality, dry]
dependencies: []
---

# Date Formatting Function Duplication

## Problem Statement

The codebase has centralized date formatting utilities in `src/lib/utils.ts` but they are being duplicated locally in multiple components with slightly different implementations.

## Findings

**Centralized utilities exist in `src/lib/utils.ts`:**
- `formatDate()`
- `formatDateTime()`
- `formatDateShort()`
- `formatDateWithWeekday()`
- `formatDateFull()`

**Local duplications found in:**

| File | Function | Issue |
|------|----------|-------|
| `src/routes/courier/services/[id]/+page.svelte` (lines 53-69) | formatDate, formatDateTime | Local versions |
| `src/routes/client/services/[id]/+page.svelte` (lines 24-40) | formatDate, formatDateTime | Identical copy |
| `src/routes/courier/clients/[id]/+page.svelte` (lines 37-42) | formatDate | Slightly different format |
| `src/routes/courier/services/+page.svelte` (line 227) | formatDate | Inline basic |
| `src/routes/courier/billing/[client_id]/+page.svelte` (line 172) | formatDate | Inline basic |
| `src/routes/client/billing/+page.svelte` (line 75) | formatDate | Inline basic |
| `src/routes/client/+page.svelte` (lines 133-139) | formatDate, formatDateTime | Both duplicated |
| `src/lib/services/insights-data.ts` (line 228) | formatDate | Another copy |

## Proposed Solutions

### Option A: Replace with imports from $lib/utils
**Pros:** Uses existing utilities, no new code
**Cons:** May need to add missing format variants
**Effort:** Medium
**Risk:** Very Low

### Option B: Keep local versions
**Pros:** No changes needed
**Cons:** Maintenance burden, inconsistency risk
**Effort:** None
**Risk:** Medium (future inconsistencies)

## Recommended Action

Replace all local formatDate/formatDateTime definitions with imports from `$lib/utils.js`.

## Technical Details

**Affected Files:** 9 files with local date formatting

## Acceptance Criteria

- [x] No local formatDate/formatDateTime functions in route files
- [x] All date formatting uses `$lib/utils.js` imports
- [x] Add any missing format variants to utils if needed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during pattern analysis | Utility functions should be consistently imported |
| 2026-01-26 | Replaced all local formatDate/formatDateTime with imports from $lib/utils.js | Used re-export pattern in insights-data.ts for backwards compatibility |

## Resources

- DRY principle
