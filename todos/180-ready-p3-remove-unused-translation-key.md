---
status: ready
priority: p3
issue_id: "180"
tags: [i18n, cleanup, code-review]
dependencies: []
---

# Remove Unused workload_no_date_requested Translation Key

## Problem Statement

The translation key `workload_no_date_requested` was specified in design doc and implementation plan but was never used in the actual implementation.

## Findings

- **Location:** `messages/en.json`, `messages/pt-PT.json`
- Key exists:
  ```json
  "workload_no_date_requested": "No specific date"  // EN
  "workload_no_date_requested": "Sem data específica"  // PT
  ```
- Grep shows no usage in src/ files
- Design doc line 272 and plan Task 1 line 29 both specify this key
- Implementation chose different approach (showing "Today" label instead)

## Proposed Solutions

### Option 1: Remove unused key (Recommended)
- Delete from both language files
- **Pros**: Clean up dead code
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

### Option 2: Implement as designed
- Use the key where "no date requested" needs to be shown
- **Pros**: Matches original design
- **Cons**: Current behavior works fine
- **Effort**: Medium
- **Risk**: Low

## Recommended Action

Remove the unused translation key from both language files.

## Technical Details

- **Affected Files**:
  - `messages/en.json`
  - `messages/pt-PT.json`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] Key removed from messages/en.json
- [ ] Key removed from messages/pt-PT.json
- [ ] Build passes

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes

Source: PR #6 code review - planned but not implemented
