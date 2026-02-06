---
status: complete
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
- [x] Resend invitation preserves updated profile data
- [x] New invitation flow still works (unchanged)
- [x] Profile reflects latest data entered by courier

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

### 2026-02-06 - Completed
Added profile update (name, phone, default_pickup_location, default_pickup_lat, default_pickup_lng, default_service_type_id) in the resend path of `create-client/index.ts`, between the email send and the return statement. Uses a single `.update()` call (no retry loop needed since the profile already exists for resend cases). On update failure, returns HTTP 207 with the invitation-sent flag so the courier knows the email went out but profile data needs manual correction.

## Notes
Source: Comprehensive audit session on 2026-02-06
