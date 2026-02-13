---
status: complete
priority: p3
issue_id: 294
tags: [code-review, pr-18, consistency, sveltekit]
dependencies: [287]
---

# Unconventional onsubmit + use:enhance pattern in PricingTab

## Problem Statement

The `handlePricingModeSubmit` function uses `onsubmit` + `e.preventDefault()` on a form that also has `use:enhance`. This works but is the only such pattern in the codebase -- every other settings form uses `use:enhance` exclusively with `cancel()` in the enhance callback.

## Findings

- Pattern agent flagged as style concern, not correctness
- Could be moved into the enhance callback using `cancel()` for consistency
- Current approach works correctly
- **Dependency on #287:** After `handleAssignAndSwitch` calls `pricingModeFormEl?.requestSubmit()`, the validation re-fires. Without #287's `invalidateAll()`, `clientsWithoutServiceType` is stale and the dialog re-opens. Fix #287 first or alongside this.

**Location:** `src/routes/courier/settings/PricingTab.svelte:101`

## Proposed Solution

Move validation into `use:enhance` callback:
```typescript
use:enhance={async ({ cancel }) => {
    if (pricingMode === "type" && profile.pricing_mode !== "type") {
        if (serviceTypes.length === 0) {
            cancel();
            toast.error(m.toast_no_service_types(), { duration: 8000 });
            return;
        }
        // ...
    }
    return async ({ result }) => { ... };
}}
```

- **Effort:** Small
- **Risk:** Low (functional behavior unchanged)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-13 | Created from PR #18 code review | Pattern agent, style only |
| 2026-02-13 | Fixed: moved validation into use:enhance with cancel() + skipPricingValidation flag | Also fixed pre-existing bug: handleSwitchWithoutAssigning infinite dialog loop |
