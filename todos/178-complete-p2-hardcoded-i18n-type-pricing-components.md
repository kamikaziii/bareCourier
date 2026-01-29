---
status: complete
priority: p2
issue_id: "178"
tags: [code-review, i18n, pr-7]
dependencies: []
---

# Hardcoded i18n Strings in Type Pricing Components

## Problem Statement

Two components contain hardcoded English strings with TODO comments indicating they need i18n support. These strings will not be translated and break the internationalization consistency of the application.

> **Implementation Plan Reference:** Tasks 10 and 14 in the plan (`2025-01-29-type-based-pricing-implementation.md`) were intended to add these i18n keys but appear incomplete.

## Findings

**Source:** Pattern Recognition Specialist Agent

**Location 1:** `src/routes/courier/settings/ServiceTypesSection.svelte` (lines 44-59)
```typescript
// TODO: Replace with actual i18n keys from Task 10
const i18n = {
  serviceTypes: 'Service Types',
  serviceTypesDesc: 'Define service types with fixed prices',
  addServiceType: 'Add Type',
  // ... 8 more hardcoded strings
};
```

**Location 2:** `src/routes/courier/settings/DistributionZonesSection.svelte` (lines 39-51)
```typescript
// TODO: Replace with actual i18n keys from Task 14
const i18n = {
  distributionZones: 'Distribution Zones',
  distributionZonesDesc: 'Select municipalities in your distribution area',
  // ... 6 more hardcoded strings
};
```

**Impact:**
- Portuguese users will see English strings for these features
- Inconsistent UX across the application

## Proposed Solutions

### Solution 1: Add i18n keys now (Recommended)
Add keys to `messages/en.json` and `messages/pt-PT.json`
- **Pros:** Complete feature, consistent UX
- **Cons:** Additional work in this PR
- **Effort:** Small (15-20 strings)
- **Risk:** Low

### Solution 2: Track as follow-up
Merge with hardcoded strings, fix in Tasks 10/14
- **Pros:** Faster PR merge
- **Cons:** Tech debt, inconsistent UX until fixed
- **Effort:** None now
- **Risk:** Medium (may be forgotten)

## Technical Details

**Affected Files:**
- `src/routes/courier/settings/ServiceTypesSection.svelte`
- `src/routes/courier/settings/DistributionZonesSection.svelte`
- `messages/en.json`
- `messages/pt-PT.json`

**Strings to add (~15):**
- serviceTypes, serviceTypesDesc, addServiceType, newServiceType
- serviceTypeNamePlaceholder, serviceTypeDescPlaceholder
- noServiceTypes, addFirstServiceType, deleteServiceType, deleteServiceTypeDesc
- price, distributionZones, distributionZonesDesc
- searchPlaceholder, selectedCount, noResults, selectAll, expandAll, collapseAll, saving

## Acceptance Criteria

- [ ] All visible strings use `$lib/paraglide/messages.js`
- [ ] Portuguese translations exist
- [ ] No hardcoded English strings in components

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by pattern-recognition-specialist agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
- Paraglide docs: https://inlang.com/m/gerre34r/library-inlang-paraglideJs
