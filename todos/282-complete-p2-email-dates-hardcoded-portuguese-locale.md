---
status: complete
priority: p2
issue_id: "282"
tags: [i18n, email, date-formatting]
dependencies: []
---

# Email Date Formatting Always Uses Portuguese Locale

## Problem Statement
`formatDatePtPT()` and `formatDateTimePtPT()` in `date-format.ts:8,22` hardcode `'pt-PT'` locale. Used in 13 email data call sites across 5 route files. English-preference users receive dates like "4 de fevereiro de 2026" in emails. Additionally, fallback strings like `'Nao especificada'` and `'Nao agendada'` are hardcoded Portuguese.

## Findings
- Location: `src/lib/utils/date-format.ts:5-29`
- 13 usages across 5 route files
- Hardcoded Portuguese fallbacks in `client/new/+page.server.ts:246`, `client/+page.server.ts:235`, `client/services/[id]/+page.server.ts:321`

## Proposed Solutions

### Option 1: Add locale parameter to format functions
- Rename to `formatDate(date, locale, fallback)` / `formatDateTime(date, locale, fallback)`
- Pass recipient's locale from the notification context
- Use `m.*` functions for fallback strings
- **Pros**: Proper i18n, consistent with notification title/message pattern
- **Cons**: Need to update 13 call sites
- **Effort**: Medium (2 hours)
- **Risk**: Low

## Recommended Action
Add locale parameter and update all call sites to pass recipient locale.

## Technical Details
- **Affected Files**: `src/lib/utils/date-format.ts`, 5 route files with 13 call sites
- **Related Components**: Email templates, notification system
- **Database Changes**: No

## Acceptance Criteria
- [x] English-locale recipients see English dates in emails
- [x] Portuguese-locale recipients still see Portuguese dates
- [x] Fallback strings are localized

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

### 2026-02-06 - Completed
**By:** Claude Code

**Changes:**
- Refactored `date-format.ts`: added locale-aware `formatDate()` and `formatDateTime()` with `AppLocale` parameter (defaults to `'pt-PT'` for backward compatibility)
- Added `dateFallback()` function for locale-aware fallback strings (`'Not scheduled'` / `'Não agendada'`, etc.)
- Kept `formatDatePtPT` and `formatDateTimePtPT` as deprecated aliases
- Updated all 13 call sites across 5 route files to pass the recipient's locale:
  - Client routes use `getCourierLocale()` (dates are for courier's emails)
  - Courier routes use `getUserLocale()` (dates are for client's emails)
- Reordered locale fetch before date formatting where needed
- Updated `BatchSuggestionConfig.buildEmailData` to accept locale parameter
- Moved per-client date formatting inside notification loops for batch operations

## Notes
Source: Comprehensive audit session on 2026-02-06
