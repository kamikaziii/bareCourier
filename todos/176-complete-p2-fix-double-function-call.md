---
status: complete
priority: p2
issue_id: "176"
tags: [svelte, performance, code-review, template]
dependencies: []
---

# Fix Double Function Call in Template

## Problem Statement

Implementation deviates from plan. The function `getWorkloadForService()` is called twice unnecessarily - once for the condition check, once to assign the value.

## Findings

- **Location:** `src/routes/courier/requests/+page.svelte:420-421`
- Current code:
  ```svelte
  {#if getWorkloadForService(service)}
      {@const workloadInfo = getWorkloadForService(service)}
  ```
- Plan specified (Task 4, lines 376-378):
  ```svelte
  {@const workloadInfo = getWorkloadForService(service)}
  {#if workloadInfo}
  ```

## Proposed Solutions

### Option 1: Use @const pattern (Recommended)
```svelte
{@const workloadInfo = getWorkloadForService(service)}
{#if workloadInfo}
```
- **Pros**: Single function call, matches plan, cleaner code
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action

Update template to use `{@const}` pattern as specified in implementation plan.

## Technical Details

- **Affected Files**: `src/routes/courier/requests/+page.svelte`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [x] Function called only once per service
- [x] No non-null assertion needed (`workloadInfo!`)
- [x] Build passes

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

### 2026-01-29 - Completed
**By:** Claude Code Review Resolution Agent
**Actions:**
- Moved `{@const workloadInfo = getWorkloadForService(service)}` to be a direct child of `{#each}` block (line 365)
- Changed condition from `{#if getWorkloadForService(service)}` to `{#if workloadInfo}` (line 421)
- Removed non-null assertion (`workloadInfo!.workload` -> `workloadInfo.workload`)
- Verified no Svelte/TypeScript errors in the modified file
- Status: complete

## Notes

Source: PR #6 code review - implementation deviated from plan

**Implementation Note:** Svelte 5 requires `{@const}` to be a direct child of block elements like `{#each}`, `{#if}`, etc. The original placement inside nested HTML elements caused a compiler error. The fix places the `{@const}` immediately after the `{#each}` opening tag.
