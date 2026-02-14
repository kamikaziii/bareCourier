---
status: complete
priority: p2
issue_id: "322"
tags: [architecture, duplication, code-review]
dependencies: []
---

# Email CSS duplicated between auth templates and send-email function

## Problem Statement

The 5 Supabase auth email templates (`supabase/templates/*.html`) each contain inline CSS styling that is also separately maintained in the `send-email` edge function's `wrapEmail()` helper. These are two independent styling systems for emails that should look consistent.

## Findings

- Auth templates: 5 HTML files with inline styles (GoTemplate syntax)
- App emails: `supabase/functions/send-email/index.ts` has `wrapEmail()` with its own CSS
- `client_invitation` template bypasses `wrapEmail()` entirely
- Styling drift between the two systems is likely over time

**Location:** `supabase/templates/*.html` and `supabase/functions/send-email/index.ts`

## Proposed Solutions

### Option 1: Shared CSS via build step
Extract common email styles into a shared file, inject during build.
- **Pros**: Single source of truth
- **Cons**: Auth templates use GoTemplate syntax (limited), build complexity
- **Effort**: Medium
- **Risk**: Medium

### Option 2: Accept duplication, add comment
Note the duplication and ensure both are updated together.
- **Pros**: No complexity added
- **Cons**: Drift risk remains
- **Effort**: Small
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Acceptance Criteria
- [ ] Email styling is consistent across auth and app emails
- [ ] OR duplication is documented and accepted

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Identified by architecture-strategist agent

### 2026-02-13 - Closed after verification
**By:** Claude Code (verification pass)
**Reason:** Verified 8 CSS classes are 100% identical, but sharing is architecturally unfeasible — auth templates use Supabase GoTemplate engine, app emails use Deno Edge Function. No shared runtime or import system exists between them. Accepted duplication.

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
