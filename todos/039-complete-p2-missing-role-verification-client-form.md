# Missing Role Verification in Client Form

---
status: complete
priority: p2
issue_id: "039"
tags: [security, authorization, pr-4]
dependencies: []
---

**Priority**: P2 (Important)
**File**: `src/routes/client/new/+page.server.ts:11-15`
**Source**: PR #4 Code Review

## Issue

The client form server action doesn't verify the user has the `client` role. While layout guards protect the route, defense-in-depth requires application-level checks.

## Current Code

```typescript
export const actions: Actions = {
  default: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) {
      return fail(401, { error: 'Not authenticated' });
    }
    // Missing: role verification
```

## Fix

Add role verification:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'client') {
  return fail(403, { error: 'Unauthorized' });
}
```

## Acceptance Criteria

- [ ] Client form action verifies client role
- [ ] Non-client users receive 403 Unauthorized
- [ ] Matches pattern used in courier actions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified in PR #4 review | Defense-in-depth for all form actions |
| 2026-01-24 | Approved during triage | Status: ready |
