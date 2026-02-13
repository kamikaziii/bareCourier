---
status: complete
priority: p2
issue_id: 288
tags: [code-review, pr-18, correctness, supabase]
dependencies: []
---

# Bulk update count always returns 0

## Problem Statement

The `bulkAssignServiceType` server action destructures `{ error, count }` from the Supabase `.update()` call, but Supabase doesn't return `count` by default. The `count` variable is always `null`, so the action always returns `count: 0`. The client-side toast shows "0 clients assigned" regardless of how many were actually updated.

## Findings

- 3 review agents flagged this (security, architecture, performance)
- The `load` function at line 108 of the same file correctly uses `{ count: 'exact', head: true }` -- this action is inconsistent
- The client-side toast uses `clientsWithoutServiceType` (the pre-loaded count) which partially mitigates the UX issue, but the server response data is still wrong

**Location:** `src/routes/courier/settings/+page.server.ts:922-927`

## Proposed Solutions

### Option A: Add count option (Recommended)
One-line fix:

```typescript
const { error, count } = await supabase
    .from('profiles')
    .update({ default_service_type_id: serviceTypeId }, { count: 'exact' })
    .eq('role', 'client')
    .is('default_service_type_id', null);
```

- **Pros:** Trivial fix, correct data returned
- **Cons:** None
- **Effort:** Trivial (1 line)
- **Risk:** None

## Recommended Action

Option A.

## Technical Details

**Affected files:**
- `src/routes/courier/settings/+page.server.ts`

**Acceptance Criteria:**
- [ ] `{ count: 'exact' }` added to `.update()` call
- [ ] Server returns actual count of updated rows

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-13 | Created from PR #18 code review | 3 agents flagged |
| 2026-02-13 | Fixed: added `{ count: 'exact' }` to .update() | `+page.server.ts:925` |

## Resources

- PR #18: fix/zone-detection-and-pricing-safeguards
- Supabase docs: `.update()` options
