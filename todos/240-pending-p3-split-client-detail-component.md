---
status: pending
priority: p3
issue_id: "240"
tags: [code-review, pr-15, refactoring, maintainability]
dependencies: []
---

# Large Component Should Be Split

## Problem Statement

The client detail page component has grown to 1125 lines, containing multiple tabs, dialogs, and complex logic. This makes the component difficult to maintain, test, and reason about. Following the single responsibility principle, it should be broken into smaller, focused components.

## Findings

**Location:** `src/routes/courier/clients/[id]/+page.svelte` (1125 lines)

The component currently contains:
1. **Three tabs:** Client Info, Services, Billing
2. **Two dialogs:** Resend Invitation, Edit Client
3. **Billing history table** with complex formatting
4. **Multiple state management concerns:** invitation status, services list, billing data
5. **API calls** for multiple unrelated features

This violates the single responsibility principle and makes:
- Code navigation difficult
- Testing individual features complex
- Reusing tab content impossible
- State management harder to reason about

## Proposed Solution

Extract into focused components:

```
src/routes/courier/clients/[id]/
├── +page.svelte              # Main page (orchestration only, ~100 lines)
├── +page.ts                  # Data loading
├── ClientInfoTab.svelte      # Profile info, invitation status (~200 lines)
├── ClientServicesTab.svelte  # Services list with filters (~250 lines)
├── ClientBillingTab.svelte   # Billing history table (~200 lines)
├── ResendInvitationDialog.svelte  # Resend dialog (~100 lines)
└── EditClientDialog.svelte   # Edit profile dialog (~150 lines)
```

Each component receives only the props it needs and emits events for actions.

## Acceptance Criteria

- [ ] Main page component is under 200 lines
- [ ] Each tab is a separate component
- [ ] Each dialog is a separate component
- [ ] State management is clear (parent manages shared state)
- [ ] No functionality regression
- [ ] Components can be tested in isolation

## Work Log

| Date | Action | Details |
|------|--------|---------|
| 2026-02-04 | Created | PR #15 code review finding |
