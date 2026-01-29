---
status: ready
priority: p3
issue_id: "171"
tags: [code-review, performance, svelte, pr-5]
dependencies: []
---

# Missing Keyed Iteration in WorkloadCard Service List

## Problem Statement

The `{#each}` block iterating over services in `WorkloadCard.svelte` lacks a key expression. Without keys, Svelte uses positional identity which can cause inefficient DOM updates when the list changes.

## Findings

**Location:** `src/lib/components/WorkloadCard.svelte` (lines 115-127)

```svelte
{#each workload.services as service}
  <div class="text-xs space-y-0.5">
    <div class="font-medium">{service.clientName}</div>
    ...
  </div>
{/each}
```

Should be:

```svelte
{#each workload.services as service (service.id)}
```

**Impact:** When services are reordered or one is removed, Svelte may update DOM nodes incorrectly or perform unnecessary re-renders.

## Proposed Solutions

### Option A: Add Key Expression (Recommended)

```svelte
{#each workload.services as service (service.id)}
```

**Pros:** Correct DOM updates, better performance, Svelte best practice
**Cons:** None
**Effort:** Trivial
**Risk:** None

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected files:**
- `src/lib/components/WorkloadCard.svelte`

## Acceptance Criteria

- [ ] `{#each}` block uses `(service.id)` key
- [ ] No visual changes to component behavior

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (performance-oracle)

**Actions:**
- Identified missing key during PR #5 review

**Learnings:**
- Always use keys for `{#each}` when items have unique identifiers

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
- Svelte docs: https://svelte.dev/docs/logic-blocks#each
