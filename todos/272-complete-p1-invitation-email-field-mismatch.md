---
status: ready
priority: p1
issue_id: "272"
tags: [bug, email, invitation, critical]
dependencies: []
---

# Invitation Email Validation Field Name Mismatch

## Problem Statement
`send-email/index.ts:98` requires `confirmation_url` in template validation, but `create-client/index.ts:68` sends `action_link`. The HTML template itself uses `data.action_link` (line 527). Every client invitation email fails with 400 "Missing required fields for client_invitation: confirmation_url".

## Findings
- Location: `supabase/functions/send-email/index.ts:98`
- Sender: `supabase/functions/create-client/index.ts:64-73`
- Template: `supabase/functions/send-email/index.ts:527` uses `data.action_link`
- Auth user is created by `generateLink()` before email send, so user exists but never receives email
- Affects both new invitations and resend invitations

## Proposed Solutions

### Option 1: Fix validation field name
- Change line 98 from `"confirmation_url"` to `"action_link"`
- **Pros**: Single-line fix, matches sender and template
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Change `confirmation_url` to `action_link` in TEMPLATE_REQUIRED_FIELDS.

## Technical Details
- **Affected Files**: `supabase/functions/send-email/index.ts`
- **Related Components**: Client invitation flow, resend invitation
- **Database Changes**: No

## Acceptance Criteria
- [ ] Invitation emails send successfully when creating a client
- [ ] Resend invitation works from client detail page
- [ ] Field validation still catches actually missing fields

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during audit triage session
- Status: **ready**

## Notes
Source: Comprehensive audit session on 2026-02-06
