---
status: complete
priority: p1
issue_id: "197"
tags: [code-review, dry, pr-10]
dependencies: []
---

# Duplicate `formatCurrency` Function Definition

## Problem Statement

Two identical `formatCurrency` implementations exist in the codebase:
1. `src/lib/utils.ts:174` (canonical)
2. `src/lib/services/insights-data.ts:220` (duplicate)

This violates DRY principle and creates maintenance burden with risk of divergence.

## Findings

**Reviewers:** kieran-rails-reviewer, architecture-strategist, pattern-recognition-specialist

Both implementations are identical:
```typescript
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}
```

## Proposed Solutions

### Option A: Remove Duplicate and Import (Recommended)

Replace `insights-data.ts` local definition with import from utils.ts:

```typescript
// In src/lib/services/insights-data.ts
import { formatCurrency } from '$lib/utils.js';
```

- **Pros:** Single source of truth, follows existing pattern
- **Cons:** None
- **Effort:** Small (5 mins)
- **Risk:** None

## Technical Details

**Files to modify:**
- `src/lib/services/insights-data.ts` - Remove lines 220-225, add import

## Acceptance Criteria

- [ ] Only one `formatCurrency` definition exists (in `src/lib/utils.ts`)
- [ ] `insights-data.ts` imports from utils.ts
- [ ] All existing functionality works unchanged

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
