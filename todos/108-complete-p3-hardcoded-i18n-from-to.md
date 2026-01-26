---
status: complete
priority: p3
issue_id: "108"
tags: [frontend, i18n]
dependencies: []
---

# Hardcoded "De:" / "Para:" Not Using i18n

## Problem Statement
Hardcoded Portuguese strings `De:` (From) and `Para:` (To) in requests page not using i18n message functions.

## Findings
- Location: `src/routes/courier/requests/+page.svelte`
  - Lines 286-287: In pending request card (pickup/delivery locations)
  - Lines 419-420: In accept dialog (pickup/delivery locations)
- Same file where other i18n strings were just fixed (TODO #091)
- Inconsistent with rest of codebase

## Proposed Solutions

### Option 1: Create i18n message keys (Recommended)
- **Pros**: Consistency with rest of app, proper i18n
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
1. Add message keys to `messages/en.json` and `messages/pt-PT.json`:
   - `location_from`: "From:" / "De:"
   - `location_to`: "To:" / "Para:"
2. Update both locations in requests page to use `m.location_from()` and `m.location_to()`

## Technical Details
- **Affected Files**:
  - messages/en.json
  - messages/pt-PT.json
  - src/routes/courier/requests/+page.svelte
- **Database Changes**: No

## Acceptance Criteria
- [x] Message keys added to both language files
- [x] Both occurrences in requests page use i18n functions
- [x] No hardcoded De:/Para: remain

## Work Log

### 2026-01-26 - Issue Created
**By:** Claude Review
**Source:** Discovered during P3 fix review - these strings were missed when fixing TODO #091

### 2026-01-26 - Fixed
**By:** Claude
**Changes:**
- Added `location_from` and `location_to` keys to en.json and pt-PT.json
- Updated lines 286, 290 (route display) to use m.location_from()/m.location_to()
- Updated lines 419, 420 (accept dialog) to use m.location_from()/m.location_to()

## Notes
Related to TODO #091 (hardcoded i18n strings) - same file, different strings that were overlooked.
