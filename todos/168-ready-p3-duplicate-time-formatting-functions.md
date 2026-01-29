---
status: ready
priority: p3
issue_id: "168"
tags: [code-review, duplication, refactor, pr-5]
dependencies: []
---

# Duplicate Time Formatting Functions

## Problem Statement

Two nearly identical time formatting functions exist in separate components. This violates DRY and could lead to inconsistent behavior if one is updated but not the other.

## Findings

**Location 1:** `src/lib/components/WorkStatusBar.svelte` (lines 55-60)
```typescript
function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
```

**Location 2:** `src/lib/components/WorkloadCard.svelte` (lines 16-21)
```typescript
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
```

Both convert minutes to human-readable format like "1h 30m". Minor differences in edge case handling (e.g., showing "0m" vs "0 min").

## Proposed Solutions

### Option A: Extract to $lib/utils.ts (Recommended)

Create a shared utility function:

```typescript
// src/lib/utils.ts
export function formatMinutesToHuman(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
```

**Pros:** Single source of truth, consistent behavior, easier testing
**Cons:** Adds one more utility function
**Effort:** Small
**Risk:** Low

### Option B: Keep Separate

Leave as-is if minor differences are intentional.

**Pros:** No changes needed
**Cons:** Duplication persists, divergence risk
**Effort:** None
**Risk:** Low (technical debt)

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected files:**
- `src/lib/utils.ts` (add function)
- `src/lib/components/WorkStatusBar.svelte` (replace local function)
- `src/lib/components/WorkloadCard.svelte` (replace local function)

## Acceptance Criteria

- [ ] Single `formatMinutesToHuman()` function in `$lib/utils.ts`
- [ ] Both components import and use the shared function
- [ ] All existing tests still pass

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (pattern-recognition-specialist, code-simplicity-reviewer)

**Actions:**
- Identified duplicate functions during PR #5 review
- Compared implementations for differences

**Learnings:**
- Common formatting functions should be in utils from the start

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
