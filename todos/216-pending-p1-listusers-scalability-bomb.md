---
status: pending
priority: p1
issue_id: "216"
tags: [code-review, performance, scalability, pr-15]
dependencies: []
---

# P1: `listUsers()` O(n) Lookup is a Scalability Time Bomb

## Problem Statement

The `create-client` edge function uses `listUsers()` to check if an email already exists, then filters client-side with `.find()`. This is O(n) where n = total users in the database.

**Why it matters:** As the user base grows, this will cause request timeouts. At ~1000 users, requests will start timing out. At 10,000 users, the function will fail completely.

## Findings

**Location:** `supabase/functions/create-client/index.ts:104-105`

```typescript
const { data: existingUsers } = await adminClient.auth.admin.listUsers();
const existingUser = existingUsers?.users?.find(u => u.email === email);
```

**Impact projections:**
| Users | Estimated Latency | Payload Size |
|-------|------------------|--------------|
| 100   | 100-200ms        | ~50KB        |
| 1,000 | 500-800ms        | ~500KB       |
| 10,000| 2-5 seconds      | ~5MB (TIMEOUT) |

## Proposed Solutions

### Option A: Use `getUserByEmail()` (Recommended)
**Pros:** O(1) indexed lookup, minimal payload
**Cons:** None
**Effort:** Small (1-2 lines)
**Risk:** Very Low

```typescript
// Replace lines 104-105 with:
const { data: existingUser, error } = await adminClient.auth.admin.getUserByEmail(email);
// existingUser is directly the user object or null
```

### Option B: Use raw SQL query on auth.users
**Pros:** Full control
**Cons:** Requires raw SQL, more complex
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `supabase/functions/create-client/index.ts`

**Components affected:**
- Client creation flow (both invitation and password modes)

**Database changes:** None required

## Acceptance Criteria

- [ ] `listUsers()` replaced with `getUserByEmail()` or equivalent O(1) lookup
- [ ] Tested with existing email (should detect duplicate)
- [ ] Tested with new email (should proceed normally)
- [ ] No regression in invitation flow

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Performance/architecture agents both flagged this |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
- Supabase Admin API: https://supabase.com/docs/reference/javascript/auth-admin-getuser
