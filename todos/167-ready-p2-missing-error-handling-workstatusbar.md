---
status: ready
priority: p2
issue_id: "167"
tags: [code-review, ux, error-handling, pr-5]
dependencies: []
---

# Missing Error Handling in WorkStatusBar Component

## Problem Statement

The `WorkStatusBar` component does not display errors to users when break operations fail. Errors from `startBreak()` and `endBreak()` are silently ignored, leaving users unaware that their action failed.

## Findings

**Location:** `src/lib/components/WorkStatusBar.svelte` (lines 44-53)

```typescript
async function toggleBreak() {
  loading = true;
  if (currentBreak) {
    await endBreak(supabase, courierId);  // Error ignored!
  } else {
    await startBreak(supabase, courierId, 'manual', 'toggle');  // Error ignored!
  }
  await loadBreakStatus();
  loading = false;
}
```

The service functions return `{ success: boolean; error?: string }` but the component doesn't check these values.

**User impact:** If a network error or database issue occurs, the user sees no feedback - just the loading state ending with no visible change.

## Proposed Solutions

### Option A: Add Error State with Toast (Recommended)

```typescript
let error = $state<string | null>(null);

async function toggleBreak() {
  loading = true;
  error = null;

  const result = currentBreak
    ? await endBreak(supabase, courierId)
    : await startBreak(supabase, courierId, 'manual', 'toggle');

  if (!result.success) {
    error = result.error || 'Failed to update break status';
    // Optionally use toast notification
  }

  await loadBreakStatus();
  loading = false;
}
```

**Pros:** User gets feedback, standard error handling pattern
**Cons:** Need to add error display UI
**Effort:** Small
**Risk:** Low

### Option B: Use Toast Notifications

Integrate with a toast library (e.g., svelte-sonner) for non-intrusive error display.

**Pros:** Cleaner UI, doesn't clutter the status bar
**Cons:** May need to add toast library
**Effort:** Medium
**Risk:** Low

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected files:**
- `src/lib/components/WorkStatusBar.svelte`

## Acceptance Criteria

- [ ] Error state is captured when break operations fail
- [ ] User sees error message when operation fails
- [ ] Error clears on next successful operation

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (pattern-recognition-specialist)

**Actions:**
- Identified missing error handling during PR #5 review
- Traced service return types showing error information available

**Learnings:**
- Service functions with error returns should always have their errors handled

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
- WorkStatusBar.svelte: `src/lib/components/WorkStatusBar.svelte:44-53`
