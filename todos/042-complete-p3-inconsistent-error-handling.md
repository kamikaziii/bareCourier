# Inconsistent Error Handling Pattern in overridePrice

---
status: complete
priority: p3
issue_id: "042"
tags: [code-quality, consistency, pr-4]
dependencies: []
---

**Priority**: P3 (Nice-to-have)
**File**: `src/routes/courier/services/[id]/+page.server.ts:114-153`
**Source**: PR #4 Code Review

## Issue

The `overridePrice` action returns `{ success: false, error }` on auth failure instead of using `fail()` like other actions in the same file.

## Current Code

```typescript
// Inconsistent - returns object instead of fail()
if (userProfile?.role !== 'courier') {
  return { success: false, error: 'Unauthorized' };
}
```

## Other Actions in Same File

```typescript
// Consistent pattern uses fail()
if (profile?.role !== 'courier') {
  return fail(403, { error: 'Unauthorized' });
}
```

## Fix

Use `fail()` for consistency:

```typescript
if (userProfile?.role !== 'courier') {
  return fail(403, { error: 'Unauthorized' });
}
```

## Acceptance Criteria

- [ ] `overridePrice` uses `fail()` for error responses
- [ ] Pattern matches other actions in the file
- [ ] Client-side error handling still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified in PR #4 review | Consistent error patterns help maintainability |
| 2026-01-24 | Approved during triage | Status: ready |
