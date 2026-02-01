---
status: complete
priority: p1
issue_id: "196"
tags: [code-review, i18n, formatting, pr-10]
dependencies: []
---

# 24 Instances of Hardcoded `.toFixed()` Not Using New Formatting Utilities

## Problem Statement

PR #10 introduces `formatCurrency()` and `formatDistance()` utilities for locale-aware number formatting, but 24 instances of hardcoded `.toFixed(2)` and `.toFixed(1)` remain in the codebase. Portuguese users will see inconsistent number formatting (e.g., "1.23" instead of "1,23").

## Findings

**Reviewers:** kieran-rails-reviewer, pattern-recognition-specialist

**Remaining hardcoded patterns:**

| File | Pattern | Count |
|------|---------|-------|
| `src/routes/courier/services/[id]/+page.svelte` | Currency + distance | 10 |
| `src/routes/client/new/+page.svelte` | Currency | 3 |
| `src/routes/courier/clients/[id]/+page.svelte` | Currency | 3 |
| `src/lib/components/ServiceLocationCard.svelte` | Distance | 2 |
| `src/routes/courier/settings/PricingTab.svelte` | Currency | 1 |
| `src/routes/courier/services/[id]/edit/+page.svelte` | Currency | 1 |
| `src/routes/courier/clients/[id]/edit/+page.svelte` | Currency | 1 |
| `src/routes/courier/clients/new/+page.svelte` | Currency | 1 |
| `src/routes/courier/services/new/+page.svelte` | Currency | 1 |
| `src/routes/client/services/[id]/+page.svelte` | Currency | 1 |

## Proposed Solutions

### Option A: Complete Migration (Recommended)
Replace all remaining `.toFixed()` patterns with `formatCurrency()` and `formatDistance()`.

- **Pros:** Consistent Portuguese locale formatting everywhere
- **Cons:** 24 file edits
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

### Option B: Defer to Follow-up PR
Merge current PR, create issue for remaining migration.

- **Pros:** Faster merge
- **Cons:** Inconsistent UX for Portuguese users
- **Effort:** N/A
- **Risk:** Medium (technical debt)

## Technical Details

**Replace patterns:**
```svelte
<!-- Before -->
€{value.toFixed(2)}
{distance.toFixed(1)} km

<!-- After -->
{formatCurrency(value)}
{formatDistance(distance)} km
```

**Import required:**
```typescript
import { formatCurrency, formatDistance } from '$lib/utils.js';
```

## Acceptance Criteria

- [ ] All currency displays use `formatCurrency()`
- [ ] All distance displays use `formatDistance()`
- [ ] Portuguese locale shows `1.234,56 €` format
- [ ] No remaining `.toFixed(2)` patterns for prices
- [ ] No remaining `.toFixed(1)` patterns for distances

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
- New utilities: `src/lib/utils.ts:174-193`
