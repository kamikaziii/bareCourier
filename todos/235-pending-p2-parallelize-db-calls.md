---
status: pending
priority: p2
issue_id: "235"
tags: [code-review, pr-15, architecture]
dependencies: []
---

# Sequential DB Calls Should Be Parallelized

## Problem Statement

Several edge functions execute independent database queries sequentially. Since these queries don't depend on each other's results, they can run in parallel, reducing latency by 50-100ms per request.

## Findings

### create-client/index.ts (Lines 75-95)

```typescript
// Sequential: ~100ms total (50ms + 50ms)
const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
// ... error handling ...

const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();
```

Both queries are independent:
- `getUserByEmail` checks if target email exists
- Profile query verifies caller is a courier

### check-client-status/index.ts (Lines 70-90)

```typescript
// Sequential: ~100ms total
const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);

const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();
```

Same pattern as create-client.

## Proposed Solution

Use `Promise.all()` to parallelize independent queries:

### create-client/index.ts - Refactored

```typescript
// Parallel: ~50ms total (max of both)
const [existingUserResult, profileResult] = await Promise.all([
  supabaseAdmin.auth.admin.getUserByEmail(email),
  supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single(),
]);

const { data: existingUser } = existingUserResult;
const { data: profile } = profileResult;

// Role check (already fetched in parallel)
if (profile?.role !== 'courier') {
  return new Response(
    JSON.stringify({ error: 'Only couriers can create clients' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Email check
if (existingUser) {
  return new Response(
    JSON.stringify({ error: 'A user with this email already exists' }),
    { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### check-client-status/index.ts - Refactored

```typescript
// Parallel execution
const [existingUserResult, profileResult] = await Promise.all([
  supabaseAdmin.auth.admin.getUserByEmail(email),
  supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single(),
]);

const { data: existingUser } = existingUserResult;
const { data: profile } = profileResult;

if (profile?.role !== 'courier') {
  return new Response(
    JSON.stringify({ error: 'Only couriers can check client status' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Continue with status check logic...
```

### Alternative: Combine with requireCourier() Helper

If implementing TODO #234 (auth helper), the parallelization can be built into the helper or done after authentication:

```typescript
// In function, after auth check:
const auth = await requireCourier(req);
if (!auth.success) return auth.response;

// Now just the email check (role already verified)
const { data: existingUser } = await auth.context.supabaseAdmin.auth.admin.getUserByEmail(email);
```

This is cleaner but doesn't parallelize as aggressively. Choose based on latency requirements.

## Performance Impact

| Approach | Auth Check | Email Check | Total |
|----------|------------|-------------|-------|
| Sequential | ~50ms | ~50ms | ~100ms |
| Parallel | ~50ms (max) | parallel | ~50ms |
| With auth helper | ~50ms | ~50ms | ~100ms |

## Acceptance Criteria

- [ ] Refactor `create-client/index.ts` to use `Promise.all()` for independent queries
- [ ] Refactor `check-client-status/index.ts` to use `Promise.all()` for independent queries
- [ ] Measure latency before/after (optional but recommended)
- [ ] All existing tests pass
- [ ] Manual test: Both endpoints return correct results

## Work Log

| Date       | Status  | Notes |
|------------|---------|-------|
| 2026-02-04 | Created | Todo created from PR #15 code review |
