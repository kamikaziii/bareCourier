# Unused goto Import in Client Form

---
status: complete
priority: p3
issue_id: "046"
tags: [code-cleanup, imports, pr-4]
dependencies: []
resolution: "INVALID - goto IS used at line 308 for cancel button navigation. Verified 2026-01-26."
---

**Priority**: P3 (Nice-to-have)
**File**: `src/routes/client/new/+page.svelte:2`
**Source**: PR #4 Code Review

## Issue

The `goto` function is imported but no longer used since the form was converted to use server action with `redirect()`.

## Current Code

```typescript
import { goto } from '$app/navigation';  // Unused after refactor
```

## Fix

Remove the unused import:

```typescript
// Remove this line
import { goto } from '$app/navigation';
```

Note: Check if `goto` is used elsewhere in the file (e.g., cancel button). If used, keep it.

## Verification

```bash
grep -n "goto" src/routes/client/new/+page.svelte
```

## Acceptance Criteria

- [ ] Unused imports removed
- [ ] `pnpm run check` passes
- [ ] No runtime errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified in PR #4 review | Clean up after refactoring |
| 2026-01-24 | Approved during triage | Status: ready |
