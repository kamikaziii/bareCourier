---
status: ready
priority: p2
issue_id: "075"
tags: [security, auth]
dependencies: []
---

# Raw Auth Error Message Displayed to User

## Problem Statement
Raw authentication error message displayed to user, may leak implementation details.

## Findings
- Location: `src/routes/login/+page.svelte:29`
- Supabase error messages shown directly
- Could reveal auth implementation details

## Proposed Solutions

### Option 1: Map error codes to friendly messages
- **Pros**: Better UX, no information leakage
- **Cons**: Need to maintain mapping
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Map Supabase error codes to user-friendly messages

## Technical Details
- **Affected Files**: src/routes/login/+page.svelte
- **Database Changes**: No

## Acceptance Criteria
- [ ] Error codes mapped to friendly messages
- [ ] No raw error strings shown

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (security warning)
