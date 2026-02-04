---
status: pending
priority: p2
issue_id: "244"
tags: [code-review, pr-15, svelte]
dependencies: []
---

# $effect Without Dependencies

## Problem Statement

A `$effect` hook is used for a one-time operation without any reactive dependencies, causing it to run unconditionally on every re-render instead of just once on mount.

## Findings

**Location:** `src/routes/courier/clients/[id]/+page.svelte:81-83`

**Issue:** The effect runs unconditionally without reactive dependencies:

```svelte
$effect(() => {
  checkClientStatus();
});
```

This pattern:
1. Runs `checkClientStatus()` on every component re-render
2. Does not track any reactive values
3. Should be a one-time mount operation

## Proposed Solution

Use `onMount()` for one-time initialization operations:

```svelte
import { onMount } from 'svelte';

onMount(() => {
  checkClientStatus();
});
```

Or if the effect should re-run based on specific dependencies, make them explicit:

```svelte
$effect(() => {
  // Track the client ID explicitly
  const clientId = data.client.id;
  checkClientStatus(clientId);
});
```

## Acceptance Criteria

- [ ] Replace dependency-free `$effect` with `onMount()`
- [ ] Verify `checkClientStatus()` only runs once on page load
- [ ] If status should update reactively, add explicit dependencies
- [ ] Test that client status is correctly fetched on page load
- [ ] Test that navigation between clients updates status correctly

## Work Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-02-04 | Created | Code review finding from PR #15 |
