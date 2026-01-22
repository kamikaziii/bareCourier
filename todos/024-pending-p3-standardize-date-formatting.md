# Standardize Date Formatting to Use getLocale()

---
status: pending
priority: p3
issue_id: "024"
tags: [code-review, i18n, consistency]
dependencies: []
---

## Problem Statement

Some pages use hardcoded locale strings like `'pt-PT'` for date formatting, while others correctly use `getLocale()` from Paraglide. This creates inconsistent date displays when users switch languages.

**Why it matters**: Users switching between PT and EN may see dates in unexpected formats in some areas of the app.

## Findings

- **Agent**: UX Review

**Inconsistent Usage Found**:

`src/routes/courier/requests/+page.svelte`:
```typescript
// WRONG - Hardcoded locale
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

// WRONG - Hardcoded locale
{m.created_at({ date: new Date(service.created_at).toLocaleDateString('pt-PT') })}
```

**Correct Usage**:

`src/routes/client/+page.svelte`:
```typescript
// CORRECT - Uses getLocale()
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(getLocale());
}
```

## Proposed Solutions

### Option 1: Search and Replace (Recommended)
Find all hardcoded locale strings and replace with `getLocale()`.

**Search pattern**: `toLocaleDateString('pt-PT'` or `toLocaleString('pt-PT'`

**Files to Check**:
- `src/routes/courier/requests/+page.svelte`
- All other route files
- Any utility functions

**Implementation**:
```typescript
// Before
new Date(dateStr).toLocaleDateString('pt-PT')

// After
import { getLocale } from '$lib/paraglide/runtime.js';
new Date(dateStr).toLocaleDateString(getLocale())
```

**Pros**: Consistent i18n behavior
**Cons**: Manual search required
**Effort**: Small
**Risk**: Low

### Option 2: Create Shared Date Utility
Create utility functions in `$lib/utils.ts` for consistent date formatting.

```typescript
// $lib/utils.ts
import { getLocale } from '$lib/paraglide/runtime.js';

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(getLocale());
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(getLocale());
}

export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
```

Then use across all files:
```svelte
import { formatDate, formatDateTime } from '$lib/utils.js';

{formatDate(service.created_at)}
```

**Pros**: Single source of truth, consistent formatting options
**Cons**: More refactoring work
**Effort**: Medium
**Risk**: Low

## Recommended Action

Option 2 - Create shared utilities. This prevents future inconsistencies and provides standardized date formats.

## Technical Details

**Affected Files** (based on grep for `'pt-PT'`):
- `src/routes/courier/requests/+page.svelte`
- (run grep to find others)

**New Utility Functions**:
```typescript
formatDate(date)      // "22/01/2026" or "01/22/2026"
formatDateTime(date)  // "22/01/2026, 14:30" or "01/22/2026, 2:30 PM"
formatDateShort(date) // "22 Jan" or "Jan 22"
formatDateLong(date)  // "22 de Janeiro de 2026" or "January 22, 2026"
```

## Acceptance Criteria

- [ ] No hardcoded locale strings in codebase
- [ ] All date formatting uses `getLocale()`
- [ ] Dates display correctly in both PT and EN
- [ ] Optional: Shared utility functions created

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Inconsistent locale usage across pages |

## Resources

- Paraglide runtime: `$lib/paraglide/runtime.js`
- Current utils: `src/lib/utils.ts`
