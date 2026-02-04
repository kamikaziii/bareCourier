---
status: ready
priority: p3
issue_id: "237"
tags: [code-review, patterns, pr-16]
dependencies: []
---

# Similar Fetch Error Handling Patterns

## Problem Statement

Two files have similar (but not identical) manual fetch patterns with try-catch. This is a minor consistency concern, not true duplication.

**Why it matters:** Bug fixes or improvements need to be applied in multiple places.

## Findings

**Source:** Pattern Recognition Agent

**Locations:**
- `src/routes/courier/services/+page.svelte:78-102`
- `src/routes/courier/requests/+page.svelte:78-102`

Both have identical:
- Manual `fetch()` calls
- Try-catch structure
- Error handling logic
- Toast success/error calls

## Proposed Solutions

### Option A: Extract Shared Helper (Recommended)

```typescript
// src/lib/utils/api.ts
export async function fetchWithToast<T>(
  url: string,
  options: RequestInit,
  messages: { loading: string; success: string; error: string }
): Promise<T | null> {
  const toastId = toast.loading(messages.loading);
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('Request failed');
    const data = await response.json();
    toast.success(messages.success, { id: toastId });
    return data;
  } catch (err) {
    toast.error(messages.error, { id: toastId, duration: Infinity });
    return null;
  }
}
```

**Pros:** DRY, single place to fix bugs
**Cons:** Adds abstraction
**Effort:** Medium
**Risk:** Low

### Option B: Use withToast() for These Operations
Adapt the existing (but unused) withToast() helper.

**Pros:** Reuses existing code
**Cons:** withToast() is typed for Supabase, not fetch
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- Fill after triage -->

## Technical Details

**Affected files:**
- `src/routes/courier/services/+page.svelte`
- `src/routes/courier/requests/+page.svelte`
- New: `src/lib/utils/api.ts` (if extracting)

## Acceptance Criteria

- [ ] Duplicated code extracted to shared helper
- [ ] Both routes use the shared helper
- [ ] Behavior unchanged (same toast messages, error handling)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Pattern agent found code duplication |

## Resources

- PR #16: feat: implement toast notification system
