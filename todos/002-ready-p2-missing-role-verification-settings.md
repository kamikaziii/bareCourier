# Missing Courier Role Verification in Settings Actions

---
status: ready
priority: p2
issue_id: "002"
tags: [code-review, security, authorization]
dependencies: []
plan_task: "N/A"
plan_status: "PARALLEL - Can be done alongside UX plan"
---

> **UX PLAN INTEGRATION**: This is a **PARALLEL** task that can be done independently of the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). Security fixes like this should be done as quick wins.

## Problem Statement

The urgency fee management actions in courier settings only check for session existence, not that the user is a courier. While RLS policies provide a backstop, application-level checks should also be present for defense-in-depth.

**Why it matters**: Defense-in-depth security principle - if RLS ever fails or is misconfigured, the application layer should still protect privileged operations.

## Findings

- **Location**: `src/routes/courier/settings/+page.server.ts`
- **Lines**: 60-91, 93-130, 132-153, 155-183
- **Agent**: security-sentinel

**Affected Actions**:
- `updateUrgencyFee`
- `createUrgencyFee`
- `toggleUrgencyFee`
- `deleteUrgencyFee`

**Current Code**:
```typescript
updateUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (!session) {
        return { success: false, error: 'Not authenticated' };
    }
    // Missing: role verification
```

## Proposed Solutions

### Option 1: Add Role Check to Each Action (Recommended)
```typescript
const { session, user } = await safeGetSession();
if (!session || !user) {
    return { success: false, error: 'Not authenticated' };
}

const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

if (profile?.role !== 'courier') {
    return { success: false, error: 'Unauthorized' };
}
```

**Pros**: Explicit, clear, matches existing patterns in other files
**Cons**: Some code duplication
**Effort**: Low (30 minutes)
**Risk**: Low

### Option 2: Create Shared Auth Utility
Extract to `src/lib/utils/auth.ts`:
```typescript
export async function requireCourierRole(locals: App.Locals) {
    const { session, user } = await locals.safeGetSession();
    if (!session || !user) throw error(401, 'Not authenticated');

    const { data } = await locals.supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (data?.role !== 'courier') throw error(403, 'Unauthorized');
    return { session, user };
}
```

**Pros**: DRY, consistent across all actions
**Cons**: Requires refactoring multiple files
**Effort**: Medium
**Risk**: Low

## Acceptance Criteria

- [ ] All 4 urgency fee actions verify courier role
- [ ] Non-courier users receive 403 Unauthorized response
- [ ] Existing tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by security-sentinel agent | RLS alone is not sufficient - defense-in-depth |
| 2026-01-22 | Approved during triage | Ready for implementation - add role check to all 4 actions |

## Resources

- Similar pattern: `src/routes/courier/services/[id]/+page.server.ts` (lines 42-53)
