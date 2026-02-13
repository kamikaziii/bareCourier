---
status: complete
priority: p3
issue_id: "302"
tags: [code-review, typescript, pr-19]
dependencies: []
---

# Extract toCoordsPair helper for repeated type assertions

## Problem Statement

The pattern `as [number, number] | null` with a null-check ternary appears 3 times in `+page.ts`. A small helper would eliminate the casts and make intent explicit.

## Findings

- Pattern appears at `src/routes/client/new/+page.ts` lines 138-139, 150-151, and in the fallback block
- Each instance is 3 lines of ternary + cast
- Found by: kieran-typescript-reviewer, code-simplicity-reviewer agents

## Proposed Solutions

### Option 1: toCoordsPair helper

```typescript
function toCoordsPair(lng: number | null | undefined, lat: number | null | undefined): [number, number] | null {
    return lng != null && lat != null ? [lng, lat] : null;
}
```

**Effort:** 5 minutes | **Risk:** Low

## Recommended Action

## Acceptance Criteria

- [ ] No `as [number, number] | null` casts remain in the PR scope
- [ ] `pnpm run check` passes

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)
