---
status: complete
priority: p3
issue_id: "116"
tags: [robustness, edge-functions, code-review]
dependencies: []
---

# isWorkingDay Re-parses Locale String Instead of Using Intl API

## Problem Statement
The `isWorkingDay` function in `notify.ts:88-93` creates a Date by re-parsing a locale-formatted string (`new Date(now.toLocaleString('en-US', { timeZone }))`). This round-trip through string formatting is fragile compared to using `Intl.DateTimeFormat` directly to get the weekday.

## Findings
- Location: `supabase/functions/_shared/notify.ts:88-93`
- `new Date(now.toLocaleString('en-US', { timeZone: timezone }))` re-parses a formatted string
- The sibling `isWithinQuietHours` function correctly uses `toLocaleTimeString` without re-parsing
- `Intl.DateTimeFormat` with `weekday` option would be more direct and reliable

## Proposed Solutions

### Option 1: Use Intl.DateTimeFormat to get weekday directly
- Replace with: `new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(now).toLowerCase()`
- **Pros**: No string re-parsing, consistent with Intl API usage
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Replace the locale string re-parse with direct `Intl.DateTimeFormat` weekday extraction.

## Technical Details
- **Affected Files**: `supabase/functions/_shared/notify.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Working day check produces correct results across all timezones
- [ ] No string re-parsing of Date objects

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Code review of commit 158e99d
