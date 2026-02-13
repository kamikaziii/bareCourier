---
status: pending
priority: p3
issue_id: "331"
tags: [duplication, email, code-review]
dependencies: []
---

# client_invitation email handler bypasses wrapEmail() helper

## Problem Statement

The `client_invitation` email handler in the send-email edge function builds its own logo HTML inline instead of using the shared `wrapEmail()` helper that all other email templates use. This means changes to the email wrapper (logo, footer, styling) won't apply to invitation emails.

Note: The original finding incorrectly described this as "logoUrl repetition" — `logoUrl` is defined once (line 282) and passed to templates. The actual issue is that `client_invitation` (line 538) constructs its own HTML with the logo rather than delegating to `wrapEmail()`.

## Findings

- `logoUrl` is defined once at line 282 of `supabase/functions/send-email/index.ts`
- All other email templates use `wrapEmail()` which handles logo, wrapper, footer
- `client_invitation` at line 538 builds its own `<img>` tag for the logo
- If the email wrapper changes (new logo, footer, styling), invitation emails won't get the update

**Location:** `supabase/functions/send-email/index.ts:538`

## Proposed Solutions

### Option 1: Refactor client_invitation to use wrapEmail()
- **Effort**: Small | **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review

### 2026-02-13 - Revised during verification
**By:** Claude Code Review (verification pass)
**Actions:**
- Corrected finding: issue is not logoUrl repetition but client_invitation bypassing wrapEmail()
- Updated title and description to reflect actual problem

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
