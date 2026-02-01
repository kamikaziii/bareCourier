---
status: complete
priority: p2
issue_id: "199"
tags: [code-review, documentation, pr-10]
dependencies: []
---

# JSDoc Mismatch for `formatDistance()` Function

## Problem Statement

The JSDoc for `formatDistance()` claims "Returns formatted distance string with 'km' suffix" but the function does NOT include the "km" suffix.

## Findings

**Reviewers:** kieran-rails-reviewer

**Current implementation:**
```typescript
/**
 * Format a distance value in kilometers using the current locale.
 * @returns Formatted distance string with "km" suffix, or empty string if null
 */
export function formatDistance(km: number | null, decimals: number = 1): string {
  if (km === null) return '';
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(km);  // No "km" suffix!
}
```

**Usage pattern shows callers add suffix manually:**
```svelte
{formatDistance(distanceKm)} km
```

## Proposed Solutions

### Option A: Update JSDoc (Recommended)

Remove the false claim about "km" suffix:
```typescript
/**
 * Format a distance value in kilometers using the current locale.
 * @returns Formatted number string, or empty string if null
 */
```

- **Pros:** Documentation matches behavior, keeps flexibility for callers
- **Cons:** None
- **Effort:** Trivial (2 mins)
- **Risk:** None

### Option B: Add Unit Suffix

```typescript
export function formatDistance(km: number | null, decimals: number = 1): string {
  if (km === null) return '';
  return new Intl.NumberFormat(getLocale(), {
    style: 'unit',
    unit: 'kilometer',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(km);
}
```

- **Pros:** Consistent with `formatCurrency()` which includes symbol
- **Cons:** Would break i18n message interpolation in RouteMap
- **Effort:** Medium (update all callers)
- **Risk:** Medium (breaking change)

## Technical Details

**File to modify:**
- `src/lib/utils.ts:181-186`

## Acceptance Criteria

- [ ] JSDoc accurately describes function behavior
- [ ] No misleading documentation

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
