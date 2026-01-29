---
status: pending
priority: p2
issue_id: "183"
tags: [code-review, dead-code, pr-7]
dependencies: []
---

# Dead Code: `detectOutOfZone` Function

## Problem Statement

The `detectOutOfZone` function is exported but never used anywhere in the codebase. It's dead code that should be removed.

## Findings

**Source:** Code Simplicity Reviewer Agent

**Location:** `src/lib/services/type-pricing.ts` (lines 295-306)

**Dead Code:**
```typescript
export async function detectOutOfZone(
    supabase: SupabaseClient,
    detectedMunicipality: string | null
): Promise<boolean | null> {
    if (!detectedMunicipality) {
        return null;
    }
    const inZone = await isInDistributionZone(supabase, detectedMunicipality);
    return !inZone;
}
```

**Usage search:** No calls found in entire codebase

**Impact:**
- 12 lines of unmaintained code
- Potential confusion for future developers
- Slight increase in bundle size

## Proposed Solutions

### Solution 1: Delete the function (Recommended)
Remove the unused export
- **Pros:** Cleaner codebase
- **Cons:** None
- **Effort:** Small (1 min)
- **Risk:** Low

## Technical Details

**Affected Files:**
- `src/lib/services/type-pricing.ts`

## Acceptance Criteria

- [ ] Function removed
- [ ] No compilation errors
- [ ] No runtime errors

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by code-simplicity-reviewer agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
