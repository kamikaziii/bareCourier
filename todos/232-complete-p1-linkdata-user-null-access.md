---
status: complete
priority: p1
issue_id: "232"
tags: [bug, security, crash, greptile, critical]
dependencies: []
---

# CRITICAL: Potential Null Access Crash in create-client Edge Function

## Problem Statement
The `create-client` edge function accesses `linkData.user.id` without a null check, which can cause a runtime crash if `linkData.user` is null.

## Findings
- Location: `supabase/functions/create-client/index.ts:272`
- Line 264 correctly checks for null: `authData = { user: linkData.user ? { ... } : null }`
- Line 272 does NOT check: `recipientUserId: linkData.user.id` - **CRASH if null!**
- The Supabase `generateLink` API can return `user: null` in edge cases

## Problem Scenario
1. `generateLink` succeeds but returns `{ user: null, properties: {...} }`
2. Line 264 sets `authData.user = null` (correctly handles it)
3. Line 272 tries to access `linkData.user.id` → **TypeError: Cannot read property 'id' of null**
4. Edge function crashes, client creation fails silently

## Proposed Solutions

### Option 1: Add null guard before sendInvitationEmail
```typescript
if (!linkData.user) {
  return new Response(
    JSON.stringify({ error: "Failed to create user invitation" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Now safe to access linkData.user.id
const emailResult = await sendInvitationEmail({
  ...
  recipientUserId: linkData.user.id,
  ...
});
```
- **Pros**: Explicit error handling, clear failure message
- **Cons**: None
- **Effort**: Small (< 15 minutes)
- **Risk**: Low

## Recommended Action
Add null check for `linkData.user` before line 268 (the sendInvitationEmail call) and return a 500 error if null.

## Technical Details
- **Affected Files**: `supabase/functions/create-client/index.ts`
- **Related Components**: Client invitation flow, Supabase Auth
- **Database Changes**: No

## Resources
- Original finding: Greptile code review on PR #15
- Supabase Auth API: `generateLink` return type includes `user: User | null`

## Acceptance Criteria
- [ ] Null check added before accessing `linkData.user.id`
- [ ] Appropriate error response returned if user is null
- [ ] No runtime crashes possible from null user

## Work Log

### 2026-02-04 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (CRITICAL priority)
- Status set to ready
- Ready to be picked up immediately

**Learnings:**
- Always verify null checks are consistent throughout a code block
- Supabase Auth APIs can return null in edge cases

## Notes
Source: Greptile code review on PR #15 (feature/client-invitation-flow)
