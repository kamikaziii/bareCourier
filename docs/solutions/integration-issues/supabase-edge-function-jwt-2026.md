---
title: "Fix Supabase Edge Function JWT Verification with 2026 API Keys"
date: 2026-02-01
category: integration
tags:
  - supabase
  - edge-functions
  - deno
  - jwt
  - ios
  - pwa
  - push-notifications
components:
  - supabase/functions/send-push/index.ts
  - supabase/functions/send-notification/index.ts
  - supabase/functions/send-email/index.ts
  - supabase/config.toml
symptom: "401 'Invalid JWT' errors and 'Buffer is not defined' errors when calling Edge Functions"
severity: critical
status: resolved
---

## Problem

Push notifications (and other Edge Function calls) were failing on iOS PWA with multiple errors:

1. **401 "Invalid JWT" errors** - Edge Functions rejected valid access tokens
2. **"Buffer is not defined" errors** - Deno runtime missing Node.js Buffer polyfill
3. **Slow auth verification** - Using `getUser()` added unnecessary network latency

Error examples from browser console:

```
POST https://xxx.supabase.co/functions/v1/send-push 401 (Unauthorized)
Response: {"error": "Invalid JWT"}

Uncaught ReferenceError: Buffer is not defined
    at isServiceRoleKey (index.ts:42)
```

## Root Causes

### 1. Supabase 2026 API Keys Incompatible with Gateway JWT Verification

Supabase projects created in 2026 use new API key formats (`sb_publishable_...`) that are **not compatible** with the gateway's built-in JWT verification. The gateway rejects valid JWTs because the key format changed.

**Evidence:** Users in [Supabase Discussion #41834](https://github.com/orgs/supabase/discussions/41834) confirmed this issue affects new projects.

### 2. Missing Buffer Import in Deno Edge Functions

Deno's runtime does not include Node.js globals like `Buffer` by default. The `timingSafeEqual` function requires `Buffer` for secure string comparison:

```typescript
// This fails without explicit import
timingSafeEqual(Buffer.from(a), Buffer.from(b));
// ReferenceError: Buffer is not defined
```

### 3. Using Slow `getUser()` Instead of `getClaims()`

The original code used `supabase.auth.getUser()` for token verification, which makes a **network round-trip** to the auth server. Supabase recommends `getClaims()` for Edge Functions because it validates the JWT locally (faster, no network dependency).

## Solution

### 1. Disable Gateway JWT Verification

Create `supabase/config.toml` to disable gateway JWT verification for all Edge Functions:

```toml
# supabase/config.toml
# https://supabase.com/docs/guides/functions/function-configuration
#
# --no-verify-jwt is required because Supabase 2026 API keys (sb_publishable_...)
# are not compatible with gateway JWT verification. Functions handle auth manually
# via auth.getClaims() which is the recommended approach.
# See: https://github.com/orgs/supabase/discussions/41834

[functions.send-push]
verify_jwt = false

[functions.send-notification]
verify_jwt = false

[functions.send-email]
verify_jwt = false

[functions.check-past-due]
verify_jwt = false

[functions.daily-summary]
verify_jwt = false

[functions.create-client]
verify_jwt = false

[functions.bootstrap-courier]
verify_jwt = false
```

**Deploy with:**
```bash
supabase functions deploy --no-verify-jwt
```

### 2. Add Buffer Import to Edge Functions

Add the Node.js Buffer polyfill import to all Edge Functions that use `timingSafeEqual`:

```typescript
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";  // ADD THIS LINE

function isServiceRoleKey(authHeader: string, serviceKey: string): boolean {
  const bearerToken = authHeader.replace('Bearer ', '');
  if (bearerToken.length !== serviceKey.length) return false;

  return timingSafeEqual(
    Buffer.from(bearerToken),
    Buffer.from(serviceKey)
  );
}
```

### 3. Switch from `getUser()` to `getClaims()`

Replace `getUser()` with `getClaims()` for faster token verification:

```typescript
// BEFORE (slow - network round-trip)
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}
const userId = user.id;

// AFTER (fast - local JWT validation)
const token = authHeader.replace('Bearer ', '');
const { data, error: claimsError } = await supabase.auth.getClaims(token);
if (claimsError || !data?.claims?.sub) {
  return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 401 });
}
const userId = data.claims.sub as string;
```

**Why `getClaims()` is better:**
- Validates JWT signature locally using the public key
- No network round-trip to auth server
- Faster response times (important for push notifications)
- Still secure - JWT signature is cryptographically verified

## Files Changed

| File | Change |
|------|--------|
| `supabase/config.toml` | **Created** - Disable gateway JWT verification for all functions |
| `supabase/functions/send-push/index.ts` | Added Buffer import, switched to getClaims() |
| `supabase/functions/send-notification/index.ts` | Added Buffer import, switched to getClaims() |
| `supabase/functions/send-email/index.ts` | Added Buffer import, switched to getClaims() |

## Complete Edge Function Auth Pattern

Here's the recommended auth pattern for all Edge Functions in this project:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Timing-safe comparison for service role key authentication.
 * Prevents timing attacks that could leak key information.
 */
function isServiceRoleKey(authHeader: string, serviceKey: string): boolean {
  const bearerToken = authHeader.replace('Bearer ', '');
  if (bearerToken.length !== serviceKey.length) return false;

  return timingSafeEqual(
    Buffer.from(bearerToken),
    Buffer.from(serviceKey)
  );
}

Deno.serve(async (req: Request) => {
  // Get auth header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "No authorization header" }),
      { status: 401 }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Check if using service role key (timing-safe)
  const isServiceRole = isServiceRoleKey(authHeader, supabaseServiceKey);

  let userId: string;

  if (isServiceRole) {
    // Trusted internal call (cron jobs, other functions)
    userId = "service-role";
  } else {
    // User token - verify using getClaims() (fast, no network round-trip)
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401 }
      );
    }

    userId = data.claims.sub as string;
  }

  // ... rest of function logic
});
```

## Testing

### Diagnostic Tool

A diagnostic component was created during debugging and can be used for future issues:

**Location:** `src/routes/courier/settings/PushDebugTab.svelte`

**Features:**
- Browser push support detection
- Service worker registration status
- Push subscription details (endpoint, keys)
- Database subscription verification
- iOS-specific checks (standalone mode, user agent)
- Test local notification
- Test server push notification with detailed logging

**Usage:** Import the component in the settings page to diagnose push notification issues.

### Manual Testing Steps

1. **Test from iOS PWA:**
   ```
   1. Open bareCourier in Safari
   2. Add to Home Screen
   3. Open from Home Screen (standalone mode)
   4. Enable push notifications
   5. Trigger a notification (create a service request)
   ```

2. **Test Edge Function directly:**
   ```bash
   curl -X POST \
     https://YOUR_PROJECT.supabase.co/functions/v1/send-push \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"user_id": "USER_ID", "title": "Test", "message": "Hello"}'
   ```

3. **Check function logs:**
   ```bash
   supabase functions logs send-push --tail
   ```

## Prevention

### For New Edge Functions

1. **Always add Buffer import** if using `timingSafeEqual` or any crypto operations
2. **Add function to `config.toml`** with `verify_jwt = false`
3. **Use `getClaims()` instead of `getUser()`** for faster auth
4. **Deploy with `--no-verify-jwt` flag**

### Code Review Checklist

- [ ] Edge Function has `import { Buffer } from "node:buffer"` if using crypto
- [ ] Function is listed in `supabase/config.toml` with `verify_jwt = false`
- [ ] Auth uses `getClaims()` not `getUser()` for token verification
- [ ] Service role key comparison uses `timingSafeEqual`

### Detection Commands

```bash
# Find Edge Functions missing Buffer import
rg "timingSafeEqual" supabase/functions --files-without-match "Buffer"

# Find functions using slow getUser()
rg "auth\.getUser\(\)" supabase/functions

# Find functions not in config.toml
diff <(ls supabase/functions | grep -v _shared) \
     <(grep -o '\[functions\.[^]]*\]' supabase/config.toml | sed 's/\[functions\.//;s/\]//')
```

## References

- [Supabase Discussion #41834](https://github.com/orgs/supabase/discussions/41834) - 2026 API key incompatibility
- [Supabase Edge Functions Auth Guide](https://supabase.com/docs/guides/functions/auth) - getClaims() documentation
- [Supabase Function Configuration](https://supabase.com/docs/guides/functions/function-configuration) - config.toml reference
- [Deno Node.js Compatibility](https://docs.deno.com/runtime/manual/node/compatibility) - Node.js polyfills in Deno
