---
status: complete
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
- [x] Login errors display in user's locale
- [x] All error strings use m.* functions

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

### 2026-02-06 - Completed
**By:** Claude Code

**Changes made:**
1. Added 5 new i18n keys to both `messages/pt-PT.json` and `messages/en.json`:
   - `auth_error_invalid_credentials`
   - `auth_error_email_not_confirmed`
   - `auth_error_too_many_requests`
   - `auth_error_already_registered`
   - `auth_error_generic`
2. Replaced hardcoded Portuguese strings in `mapAuthError()` with `m.auth_error_*()` calls
3. Changed `errorMap` type from `Record<string, string>` to `Record<string, () => string>` (lazy evaluation to ensure locale is resolved at call time)
4. Recompiled Paraglide messages

## Notes
Source: Comprehensive audit session on 2026-02-06. Possibly intentional for Portuguese-only audience, but inconsistent with i18n patterns elsewhere.
