---
status: complete
priority: p2
issue_id: "198"
tags: [code-review, performance, pr-10]
dependencies: []
---

# Intl.NumberFormat Created on Every Format Call

## Problem Statement

`formatCurrency()` and `formatDistance()` create new `Intl.NumberFormat` instances on every call. `Intl.NumberFormat` construction is expensive (involves ICU data lookup, locale parsing, and option validation).

In billing tables with 50+ rows, this causes 100-150 format calls per page load, adding 200-300ms of overhead.

## Findings

**Reviewers:** performance-oracle

**Current implementation:**
```typescript
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}
```

**Performance impact:**
- Each instantiation: 0.5-2ms depending on browser/locale
- 100 services displayed: 200-300ms overhead
- CSV export with 1000 rows: 2-4 seconds

## Proposed Solutions

### Option A: Cache Formatters Per Locale (Recommended)

```typescript
const formatterCache = new Map<string, {
  currency: Intl.NumberFormat;
  distance: Map<number, Intl.NumberFormat>;
}>();

function getFormatters(locale: string) {
  let cached = formatterCache.get(locale);
  if (!cached) {
    cached = {
      currency: new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR'
      }),
      distance: new Map()
    };
    formatterCache.set(locale, cached);
  }
  return cached;
}

export function formatCurrency(value: number): string {
  return getFormatters(getLocale()).currency.format(value);
}
```

- **Pros:** 95-99% reduction in overhead after first call
- **Cons:** Slightly more code
- **Effort:** Small (30 mins)
- **Risk:** Low

## Technical Details

**File to modify:**
- `src/lib/utils.ts`

**Expected improvement:**
- Uncached (1000 iterations): 500-2000ms
- Cached (1000 iterations): 5-20ms

## Acceptance Criteria

- [ ] Formatter instances are cached per locale
- [ ] First call creates cache, subsequent calls reuse
- [ ] Cache invalidates correctly on locale change
- [ ] Billing pages render faster

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
