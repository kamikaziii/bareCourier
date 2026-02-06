---
status: ready
priority: p2
issue_id: "279"
tags: [bug, invitation, client-creation]
dependencies: []
---

# Resend Invitation Path Silently Discards Profile Data

## Problem Statement
When courier creates a client with an email that already has an unconfirmed auth user, `create-client/index.ts` enters the resend path (line 160) and returns at line 215 — before the profile update block (lines 308-347). Any form data (phone, location, service type) is silently dropped.

## Findings
- Location: `supabase/functions/create-client/index.ts:160-224`
- Profile update block: lines 308-347 (never reached on resend)
- Frontend shows success toast and navigates away

## Proposed Solutions

### Option 1: Add profile update in resend path
- Before returning at line 213, upsert the profile with incoming form data
- **Pros**: Consistent behavior between new and resend flows
- **Cons**: Slightly more complex resend path
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Recommended Action
Add profile update with incoming phone/location/service-type data in the resend path before returning.

## Technical Details
- **Affected Files**: `supabase/functions/create-client/index.ts`
- **Related Components**: Client creation form
- **Database Changes**: No

## Acceptance Criteria
- [ ] Resend invitation preserves updated profile data
- [ ] New invitation flow still works
- [ ] Profile reflects latest data entered by courier

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
