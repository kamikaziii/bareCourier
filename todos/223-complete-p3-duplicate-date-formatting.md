---
status: complete
priority: p3
issue_id: "223"
tags: [code-quality, code-review, dry, pr-13]
dependencies: []
---

# Duplicate Date Formatting Logic (DRY Violation)

## Problem Statement

The same date formatting pattern is repeated 7+ times across multiple server action files. This violates DRY (Don't Repeat Yourself) and makes it harder to maintain consistent date formatting.

**Impact:** Technical debt; risk of inconsistent formatting if one location is updated but others aren't.

## Findings

**Duplicated Pattern:**
```typescript
const formattedDate = someDate
  ? new Date(someDate).toLocaleDateString('pt-PT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  : 'Fallback text';
```

**Locations:**
1. `src/routes/client/+page.server.ts` - lines 65-69
2. `src/routes/client/+page.server.ts` - lines 147-151
3. `src/routes/client/+page.server.ts` - lines 256-260
4. `src/routes/client/+page.server.ts` - lines 284-288
5. `src/routes/client/+page.server.ts` - lines 383-387
6. `src/routes/client/new/+page.server.ts` - lines 244-248
7. `src/routes/courier/services/+page.server.ts` - lines 99-105
8. `src/routes/courier/services/[id]/+page.server.ts` - lines 93-99

## Proposed Solutions

### Option A: Extract to Utility Function (Recommended)

Create `src/lib/utils/date-format.ts`:

```typescript
export function formatDatePtPT(date: Date | string | null, fallback = ''): string {
  if (!date) return fallback;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Usage:
import { formatDatePtPT } from '$lib/utils/date-format.js';
const formattedDate = formatDatePtPT(service.suggested_date, 'Não especificada');
```

**Pros:** Single source of truth, easy to update
**Cons:** Minor refactoring needed
**Effort:** Small
**Risk:** Low

### Option B: Add Locale Parameter for Flexibility

```typescript
export function formatDate(
  date: Date | string | null,
  locale: 'pt-PT' | 'en' = 'pt-PT',
  fallback = ''
): string {
  if (!date) return fallback;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}
```

**Pros:** Supports future i18n needs
**Cons:** Slightly more complex
**Effort:** Small
**Risk:** Low

## Technical Details

**New File:**
- `src/lib/utils/date-format.ts`

**Files to Update:**
- `src/routes/client/+page.server.ts` (5 locations)
- `src/routes/client/new/+page.server.ts` (1 location)
- `src/routes/courier/services/+page.server.ts` (1 location)
- `src/routes/courier/services/[id]/+page.server.ts` (1 location)

## Acceptance Criteria

- [ ] `formatDatePtPT` utility function created
- [ ] All duplicate date formatting replaced with utility call
- [ ] Existing behavior unchanged (same output format)
- [ ] Tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Pattern recognition specialist identified DRY violation |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
