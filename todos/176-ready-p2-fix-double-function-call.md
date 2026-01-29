---
status: ready
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

- [ ] Function called only once per service
- [ ] No non-null assertion needed (`workloadInfo!`)
- [ ] Build passes

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes

Source: PR #6 code review - implementation deviated from plan
