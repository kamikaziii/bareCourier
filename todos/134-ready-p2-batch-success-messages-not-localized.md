---
status: ready
priority: p2
issue_id: "134"
tags: [i18n, batch-selection]
dependencies: []
---

# Batch Success Messages Not Localized

## Problem Statement
The batch mark-delivered and batch accept success messages use hardcoded English strings instead of i18n message functions. The rest of the app is fully localized (Portuguese + English). The existing dashboard batch reschedule uses `m.reschedule_success()`.

## Findings
- Location: `src/routes/courier/services/+page.svelte:84` — `` `${selectedCount} services marked as delivered` ``
- Location: `src/routes/courier/requests/+page.svelte:68` — `` `${selectedCount} requests accepted` ``
- Dashboard batch reschedule uses `m.reschedule_success()` (i18n function)
- Both files have hardcoded English strings

## Proposed Solutions

### Option 1: Add i18n message keys and use them
- Add `batch_mark_delivered_success` and `batch_accept_success` to `messages/en.json` and `messages/pt-PT.json`
- Replace hardcoded strings with `m.batch_mark_delivered_success({ count: selectedCount })`
- **Pros**: Consistent with codebase pattern
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Add message keys to both locale files and replace the hardcoded strings.

## Technical Details
- **Affected Files**: `src/routes/courier/services/+page.svelte`, `src/routes/courier/requests/+page.svelte`, `messages/en.json`, `messages/pt-PT.json`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Batch success messages display in the user's selected locale
- [ ] Message keys added to both en.json and pt-PT.json
- [ ] Paraglide messages compiled

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: UX audit implementation review on 2026-01-27
