---
status: ready
priority: p1
issue_id: "234"
tags: [code-review, ux, pr-16]
dependencies: []
---

# Missing Error Handling in Form Submissions

## Problem Statement

Several routes only handle success cases but don't display error toasts for failed form submissions. Users get no feedback when operations fail silently.

**Why it matters:** Silent failures create terrible UX - users think their action worked when it didn't.

## Findings

**Source:** Pattern Recognition Agent

**Locations with missing error handling:**

1. **`src/routes/courier/settings/AccountTab.svelte`**
   - Lines 72-82, 125-133, 194-202
   - Missing: `if (result.type === 'failure')` error handling
   - Only shows success toast

2. **`src/routes/courier/settings/DistributionZonesSection.svelte`**
   - Lines ~217-228
   - Same pattern: success only

3. **`src/routes/courier/settings/SchedulingTab.svelte`**
   - Multiple form handlers
   - Inconsistent error patterns

**Contrast with correct pattern in `src/routes/courier/clients/[id]/edit/+page.svelte:140-161`:**
```typescript
if (result.type === 'failure' && result.data?.error) {
  toast.error(result.data.error, { duration: Infinity });
}
```

## Proposed Solutions

### Option A: Add Error Handling to All Forms (Recommended)

```typescript
use:enhance={async () => {
  return async ({ result }) => {
    await applyAction(result);
    if (result.type === 'success') {
      await invalidateAll();
      toast.success(m.toast_settings_saved());
    } else if (result.type === 'failure' && result.data?.error) {
      toast.error(m.toast_settings_failed(), { duration: Infinity });
    }
  };
}}
```

**Pros:** Consistent UX, users always get feedback
**Cons:** Requires updates to 3+ files
**Effort:** Medium
**Risk:** Low

### Option B: Create Shared Form Enhancement Helper
Extract common pattern to reduce duplication.

**Pros:** DRY, consistent
**Cons:** More abstraction
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- Fill after triage -->

## Technical Details

**Affected files:**
- `src/routes/courier/settings/AccountTab.svelte` (3 forms)
- `src/routes/courier/settings/DistributionZonesSection.svelte` (1 form)
- `src/routes/courier/settings/SchedulingTab.svelte` (multiple)

## Acceptance Criteria

- [ ] All form submissions show error toast on failure
- [ ] Error messages are localized (use m.toast_* keys)
- [ ] Test: Submit invalid data, verify error toast appears

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Pattern agent found incomplete error handling |

## Resources

- PR #16: feat: implement toast notification system
- Golden pattern: `src/routes/courier/clients/[id]/edit/+page.svelte:140-161`
