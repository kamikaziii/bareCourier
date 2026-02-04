---
status: pending
priority: p2
issue_id: "234"
tags: [code-review, pr-15, architecture]
dependencies: []
---

# Auth Validation Boilerplate Duplication

## Problem Statement

All four edge functions contain nearly identical authentication validation code (~40 lines each). This duplicated boilerplate:

1. Increases maintenance burden (fixes must be applied 4x)
2. Creates risk of inconsistent auth handling across functions
3. Bloats each function with repetitive code

## Findings

### create-client/index.ts (Lines 30-70)

```typescript
// Get the authorization header
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Create Supabase client with service role for admin operations
const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Create Supabase client with user's JWT to verify their identity
const supabaseUser = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});

// Get the authenticated user
const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
if (userError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Verify the user is a courier
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'courier') {
  return new Response(JSON.stringify({ error: 'Only couriers can perform this action' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### check-client-status/index.ts (Lines 25-65)

Identical pattern with minor variations in error messages.

### reset-client-password/index.ts (Lines 25-65)

Identical pattern.

### send-email/index.ts (Lines 35-75)

Identical pattern.

## Proposed Solution

Extract authentication logic to `_shared/auth.ts`:

```typescript
// supabase/functions/_shared/auth.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import { corsHeaders } from './cors.ts';

interface AuthContext {
  user: { id: string; email: string };
  supabaseAdmin: SupabaseClient<Database>;
  supabaseUser: SupabaseClient<Database>;
}

type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; response: Response };

export async function requireCourier(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const supabaseUser = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'courier') {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: 'Only couriers can perform this action' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      ),
    };
  }

  return {
    success: true,
    context: {
      user: { id: user.id, email: user.email! },
      supabaseAdmin,
      supabaseUser,
    },
  };
}
```

### Usage in Edge Functions

```typescript
// create-client/index.ts
import { requireCourier } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireCourier(req);
  if (!auth.success) {
    return auth.response;
  }

  const { user, supabaseAdmin } = auth.context;

  // Function-specific logic starts here...
});
```

## Acceptance Criteria

- [ ] Create `supabase/functions/_shared/auth.ts` with `requireCourier()` helper
- [ ] Refactor `create-client/index.ts` to use helper
- [ ] Refactor `check-client-status/index.ts` to use helper
- [ ] Refactor `reset-client-password/index.ts` to use helper
- [ ] Refactor `send-email/index.ts` to use helper
- [ ] All existing tests pass
- [ ] Manual test: All four endpoints still work correctly

## Work Log

| Date       | Status  | Notes |
|------------|---------|-------|
| 2026-02-04 | Created | Todo created from PR #15 code review |
