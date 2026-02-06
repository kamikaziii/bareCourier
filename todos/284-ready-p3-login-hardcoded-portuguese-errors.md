---
status: ready
priority: p3
issue_id: "284"
tags: [i18n, auth, ux]
dependencies: []
---

# Login Page Error Messages Hardcoded in Portuguese

## Problem Statement
`login/+page.svelte:22-48` — `mapAuthError` function hardcodes Portuguese strings instead of using `m.*` i18n functions. English-locale users see Portuguese error messages on the login page.

## Findings
- Location: `src/routes/login/+page.svelte:22-48`
- 7 hardcoded Portuguese strings + 1 generic fallback
- Inconsistent with every other page that uses Paraglide messages

## Proposed Solutions

### Option 1: Replace with m.* message functions
- Add translation keys for auth errors
- Replace hardcoded strings with `m.login_error_*()` calls
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] Login errors display in user's locale
- [ ] All error strings use m.* functions

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06. Possibly intentional for Portuguese-only audience, but inconsistent with i18n patterns elsewhere.
