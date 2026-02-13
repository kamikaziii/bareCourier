---
status: pending
priority: p2
issue_id: "320"
tags: [process, code-review]
dependencies: []
---

# Formatting churn in 3 component files obscures real changes (~585 lines noise)

## Problem Statement

Three Svelte component files have extensive whitespace/formatting changes (tabs to spaces, reindentation) mixed with real functional changes. This makes the PR harder to review and increases the chance of bugs being missed.

## Findings

- `src/lib/components/AppShell.svelte` — logo addition buried in formatting churn
- `src/lib/components/RouteMap.svelte` — new props buried in formatting churn
- `src/routes/courier/settings/PushDebugTab.svelte` — 2 lines of real change, ~280 lines formatting

**Location:** Above 3 files

## Proposed Solutions

### Option 1: Separate formatting into its own commit (Recommended)
Split the formatting-only changes into a dedicated commit so functional changes are isolated.
- **Pros**: Clean review, clear intent
- **Cons**: Requires rebasing/rewriting commits
- **Effort**: Small
- **Risk**: Low

### Option 2: Accept as-is with a note
Add PR comment noting the formatting churn.
- **Pros**: No work needed
- **Cons**: Future blame/bisect harder
- **Effort**: None
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Acceptance Criteria
- [ ] Formatting changes separated from functional changes
- [ ] OR acknowledged as acceptable

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Flagged by all review agents

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
