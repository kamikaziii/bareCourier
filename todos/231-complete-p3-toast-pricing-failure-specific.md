---
status: complete
priority: p3
issue_id: "231"
tags: [ux, i18n, toast, greptile]
dependencies: []
---

# Use Specific Warning Message for Pricing Failure in Client Creation

## Problem Statement
When client creation succeeds but pricing configuration fails, the warning toast uses generic `m.toast_error_generic()` instead of a specific message explaining what happened.

## Findings
- Location: `src/routes/courier/clients/new/+page.svelte:167`
- User sees generic error message when pricing fails after client creation
- Message should explain: "Client created, but pricing configuration failed to save"

## Proposed Solutions

### Option 1: Add specific i18n key and use it
- **Pros**: Clear communication to user about partial success
- **Cons**: Need to add new translation key
- **Effort**: Small (< 15 minutes)
- **Risk**: Low

## Recommended Action
1. Add new i18n key `toast_client_created_pricing_failed` with message: "Client created, but pricing configuration failed to save. You can add it later."
2. Replace `toast.warning(m.toast_error_generic(), { duration: 6000 })` with the new specific message

## Technical Details
- **Affected Files**:
  - `src/routes/courier/clients/new/+page.svelte`
  - `messages/en.json`
  - `messages/pt-PT.json`
- **Related Components**: Toast notification system, client creation flow
- **Database Changes**: No

## Resources
- Original finding: Greptile code review on PR #16

## Acceptance Criteria
- [ ] Toast shows specific message when client created but pricing fails
- [ ] New translation keys added for EN and PT-PT
- [ ] Duration remains 6000ms for visibility

## Work Log

### 2026-02-04 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status set to ready

## Notes
Source: Greptile code review on PR #16 (feat/toast-system)
