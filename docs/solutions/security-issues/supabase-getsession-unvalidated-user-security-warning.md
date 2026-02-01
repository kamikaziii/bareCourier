# Fix Supabase getSession Security Warning - Use Validated User Object

---
title: "Fix Supabase getSession Security Warning"
date: 2026-02-01
category: security
tags:
  - supabase
  - authentication
  - ssr
  - sveltekit
  - jwt
component: src/routes/+layout.server.ts
symptom: "Console warning: Using the user object as returned from supabase.auth.getSession() could be insecure"
severity: medium
status: resolved
---

## Problem

Dev server logs showed this warning:

```
Using the user object as returned from supabase.auth.getSession() or from some
supabase.auth.onAuthStateChange() events could be insecure! This value comes
directly from the storage medium (usually cookies on the server) and may not be
authentic. Use supabase.auth.getUser() instead which authenticates the data by
contacting the Supabase Auth server.
```

## Root Cause

In `src/routes/+layout.server.ts`, the code was accessing `session.user` instead of using the validated `user` object:

```typescript
// BEFORE (triggers warning - INSECURE)
const { session } = await safeGetSession();

const safeSession = session
  ? {
      expires_at: session.expires_at,
      user: {
        id: session.user.id,      // ← Unvalidated! From cookies
        email: session.user.email
      }
    }
  : null;
```

**Why this is insecure:**
- `getSession()` reads the JWT from cookies without validating the signature
- A malicious user could craft a fake session cookie with manipulated user data
- `session.user` could contain tampered `id`, `email`, or other claims

## Solution

Use the `user` object from `safeGetSession()`, which comes from `getUser()` and is validated by the auth server:

```typescript
// AFTER (no warning - SECURE)
const { session, user } = await safeGetSession();

const safeSession = session && user
  ? {
      expires_at: session.expires_at,
      user: {
        id: user.id,      // ← Validated by auth server
        email: user.email
      }
    }
  : null;
```

## Why This Works

The `safeGetSession()` function in `hooks.server.ts` returns both objects:

```typescript
event.locals.safeGetSession = async () => {
  // Step 1: Validate JWT by calling getUser() - contacts auth server
  const { data: { user }, error } = await event.locals.supabase.auth.getUser();

  if (error) {
    return { session: null, user: null };
  }

  // Step 2: Get session metadata (only after validation)
  const { data: { session } } = await event.locals.supabase.auth.getSession();

  return { session, user };
};
```

| Source | Method | Validated? | Safe to Trust? |
|--------|--------|------------|----------------|
| `session.user` | `getSession()` | No - reads from cookies | **No** |
| `user` | `getUser()` | Yes - contacts auth server | **Yes** |

## Prevention

### Code Pattern

Always destructure both `session` and `user`:

```typescript
// ✅ CORRECT
const { session, user } = await safeGetSession();
const userId = user.id;

// ❌ WRONG
const { session } = await safeGetSession();
const userId = session.user.id;
```

### Detection Commands

```bash
# Find session.user access in server files
rg 'session\.user\.' --glob '*.server.ts'

# Find missing user destructuring
rg 'const \{ session \} = await safeGetSession' src/
```

### Code Review Checklist

- [ ] No `session.user` access in server-side code
- [ ] `safeGetSession()` destructures both `session` and `user`
- [ ] User ID queries use `user.id`, not `session.user.id`

## Related Files

- `src/hooks.server.ts` - `safeGetSession()` implementation
- `src/routes/+layout.server.ts` - Root layout (fixed)
- `src/routes/courier/+layout.server.ts` - Example of correct pattern
- `src/routes/client/+layout.server.ts` - Example of correct pattern

## References

- [Supabase Auth Sessions Docs](https://supabase.com/docs/guides/auth/sessions)
- [supabase-js Issue #1010](https://github.com/supabase/supabase-js/issues/1010)
- [auth-js PR #879](https://github.com/supabase/auth-js/pull/879) - Warning behavior fix
