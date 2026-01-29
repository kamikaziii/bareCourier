---
status: complete
priority: p2
issue_id: "177"
tags: [i18n, code-review, design-gap]
dependencies: []
---

# Add Short Status Translation Keys

## Problem Statement

Status labels are extracted by parsing localized strings with `.split('(')[0]` and `.split(' ')[0]`. This is fragile and will break silently if translation formats change or when adding new languages.

## Findings

- **Location:** `src/lib/components/WorkloadSummary.svelte:37-43`
- Current fragile code:
  ```typescript
  const statusLabel = $derived(
    workload.status === 'comfortable'
      ? m.workload_status_comfortable({ hours: '' }).split('(')[0].trim()
      : workload.status === 'tight'
        ? m.workload_status_tight({ hours: '' }).split('(')[0].trim()
        : m.workload_status_overloaded({ hours: '' }).split(' ')[0]
  );
  ```
- Different split strategies for different statuses (inconsistent)
- Languages without spaces/parentheses in expected positions will break
- **Design Gap**: Design prioritized key reuse over robustness

## Proposed Solutions

### Option 1: Add dedicated short keys (Recommended)

**Add to messages/en.json:**
```json
"workload_status_comfortable_short": "Compatible",
"workload_status_tight_short": "Tight",
"workload_status_overloaded_short": "Overloaded"
```

**Add to messages/pt-PT.json:**
```json
"workload_status_comfortable_short": "Compatível",
"workload_status_tight_short": "Apertado",
"workload_status_overloaded_short": "Excede"
```

- **Pros**: Robust, translator-friendly, explicit
- **Cons**: 6 more i18n entries
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action

Add dedicated translation keys and update WorkloadSummary.svelte to use them.

## Technical Details

- **Affected Files**:
  - `messages/en.json`
  - `messages/pt-PT.json`
  - `src/lib/components/WorkloadSummary.svelte`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] New translation keys added to both language files
- [ ] WorkloadSummary uses new keys directly (no string manipulation)
- [ ] Build passes
- [ ] Labels display correctly in both languages

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Identified as design gap

## Notes

Source: PR #6 code review - design gap (fragile pattern)
