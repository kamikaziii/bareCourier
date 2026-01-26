---
status: complete
priority: p3
issue_id: "099"
tags: [architecture, dry]
dependencies: []
resolution: "WON'T FIX - Duplication is intentional. Extracting shared helper breaks SvelteKit's type inference, causing 46 TypeScript errors. The 5-line duplication is acceptable trade-off for type safety."
---

# Identical Duplicate Layout (Client/Courier)

## Problem Statement
Client +layout.ts is identical duplicate of courier layout load function.

## Findings
- Location: `src/routes/client/+layout.ts`
- Same data merging pattern as courier layout
- Violates DRY principle

## Proposed Solutions

### Option 1: Extract shared logic
- **Pros**: DRY, single source of truth
- **Cons**: Minor refactor
- **Effort**: Small
- **Risk**: Low

## Recommended Action
~~Extract shared layout logic to $lib helper function~~

**DECISION: Keep duplication intentional.**

## Technical Details
- **Affected Files**: src/routes/client/+layout.ts, src/routes/courier/+layout.ts
- **Database Changes**: No

## Acceptance Criteria
- [x] ~~Shared helper created~~ Reverted - breaks types
- [x] Duplication documented as intentional
- [x] TypeScript check passes (0 errors)

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

### 2026-01-26 - Attempted Fix, Then Reverted
**By:** Claude Review
**Actions:**
1. Extracted `createProtectedLayoutLoad()` helper to `$lib/utils.ts`
2. Both layouts updated to use helper
3. TypeScript check revealed 46 errors - `data.supabase` and `data.profile` typed as `unknown`
4. **Root cause**: SvelteKit generates route-specific types via `./$types`. Generic helper cannot capture these types.
5. **Decision**: Reverted to inline functions. 5-line duplication is acceptable trade-off for full type safety.

## Notes
Source: Full codebase review 2026-01-26 (architecture warning)

**Why duplication is OK here:**
1. Only 5 lines of code duplicated
2. SvelteKit's type system requires route-specific `LayoutLoad` types
3. Abstraction cost (broken types) > DRY benefit
4. This is a known SvelteKit pattern limitation
