# Fix Svelte 5 State Referenced Locally Warnings

---
status: ready
priority: p3
issue_id: "011"
tags: [code-review, quality, svelte5]
dependencies: []
---

## Problem Statement

TypeScript check (`pnpm run check`) shows multiple warnings about Svelte 5 state being referenced locally, which only captures the initial value.

**Why it matters**: Could cause bugs where state changes don't reflect in derived values.

## Findings

- **Agent**: TypeScript check output
- **Files with warnings**:
  - `src/lib/components/SchedulePicker.svelte:44`
  - `src/routes/client/new/+page.svelte:20`
  - `src/routes/courier/billing/[client_id]/+page.svelte:17-24`
  - `src/routes/courier/clients/[id]/edit/+page.svelte:15-17`
  - `src/routes/courier/services/[id]/edit/+page.svelte:15-17`

**Example Warning**:
```
This reference only captures the initial value of `data`.
Did you mean to reference it inside a derived instead?
```

## Proposed Solutions

### Option 1: Use $derived for Props-Based Initial State
For form fields that initialize from `data`:

```svelte
// Before (warning)
let name = $state(data.client.name);

// After (no warning) - if you want reactive updates
const name = $derived(data.client.name);

// OR - if you just want one-time initialization (and understand the warning)
// Add a comment explaining the intentional behavior
```

**Note**: In edit forms, the warning is often a false positive - you usually DO want to capture the initial value and let the user edit it without it resetting when data changes.

**Effort**: Low
**Risk**: Low

## Acceptance Criteria

- [ ] `pnpm run check` passes without state_referenced_locally warnings
- [ ] Edit forms still work correctly (don't reset on data changes)
- [ ] Comments added where warnings are intentionally suppressed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by TypeScript check | Svelte 5 runes have stricter warnings than Svelte 4 |
| 2026-01-22 | Approved during triage | Ready for implementation - fix 11 warnings across 5 files |
