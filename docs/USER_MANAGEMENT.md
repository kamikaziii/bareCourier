# User Management

This document explains how to properly create and manage users in bareCourier.

## User Roles

| Role | Description | How to Create |
|------|-------------|---------------|
| `courier` | Admin user - manages clients, services, reports | Bootstrap edge function (first time) or Supabase Dashboard |
| `client` | Business user - requests pickups/deliveries | Courier creates via app, or self-signup |

## Creating Users

### Option 1: Courier Creates Clients (Normal Flow)

Once a courier account exists, they can create client accounts through the app:

1. Log in as courier
2. Navigate to **Clients** → **Add Client**
3. Fill in email, password, name, phone, pickup location
4. The `create-client` edge function creates the user via Admin API

This is the recommended flow for creating client accounts.

### Option 2: Client Self-Signup

Clients can sign up themselves through the login page (if enabled). The `handle_new_user` trigger automatically:
- Creates a profile with `role = 'client'` (always, for security)
- Sets name from user metadata or email

**Important:** Self-signup ALWAYS creates client accounts. This prevents privilege escalation.

### Option 3: Bootstrap First Courier Account

For the **first courier account** (or when no courier exists), use the bootstrap edge function:

#### Step 1: Deploy Bootstrap Function

```bash
# From project root, deploy the bootstrap function
```

Or use Supabase MCP:

```typescript
// Deploy via MCP
mcp__supabase__deploy_edge_function({
  name: "bootstrap-courier",
  verify_jwt: false,  // Required - no auth exists yet
  files: [{ name: "index.ts", content: BOOTSTRAP_CODE }]
})
```

**Bootstrap function code:**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "email, password, and name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user with Admin API (proper JWT will be generated on login)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "courier" },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile to courier role (trigger creates it as 'client' by default)
    if (authData.user) {
      await adminClient
        .from("profiles")
        .update({ role: "courier" })
        .eq("id", authData.user.id);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: authData.user?.id, email: authData.user?.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

#### Step 2: Call the Function

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/bootstrap-courier" \
  -H "Content-Type: application/json" \
  -d '{"email": "courier@example.com", "password": "securepassword", "name": "Main Courier"}'
```

#### Step 3: Delete the Function (IMPORTANT!)

After creating the courier account, **immediately delete** the bootstrap function:

1. Go to Supabase Dashboard → Edge Functions
2. Find `bootstrap-courier`
3. Click ⋮ → Delete

This function has `verify_jwt: false` and could be exploited if left deployed.

### Option 4: Supabase Dashboard (Manual)

For emergency access or testing:

1. Go to Supabase Dashboard → Authentication → Users
2. Click **Add User** → **Create New User**
3. Fill in email and password
4. After creation, go to **Table Editor** → `profiles`
5. Find the new user's row and change `role` to `courier`

## Why NOT Raw SQL?

**Do not create users via raw SQL inserts into `auth.users`.** This approach fails because:

1. Missing `raw_app_meta_data` field (needs `{"provider": "email", "providers": ["email"]}`)
2. Missing proper password hashing metadata
3. JWT tokens won't validate correctly

Always use the Supabase Admin API (`auth.admin.createUser()`) which handles all auth internals correctly.

## Security Notes

### Role Enforcement

The `handle_new_user` trigger (migration 007) enforces that all self-signups get `role = 'client'`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    'client',  -- ALWAYS client for self-signup (security fix)
    coalesce(new.raw_user_meta_data->>'name', new.email)
  );
  return new;
end;
$$;
```

This prevents users from setting `role: "courier"` in their signup metadata.

### Edge Function JWT Validation

The `create-client` edge function uses `verify_jwt: false` because Supabase is deprecating the old JWT verification method. Instead, we validate manually using `getUser()`:

```typescript
// Modern JWT validation (recommended by Supabase)
const { data: { user }, error } = await userClient.auth.getUser();
```

See: https://supabase.com/docs/guides/functions/auth

## Troubleshooting

### "Database error querying schema" on login

The user was likely created via raw SQL. Delete and recreate using Admin API.

### "Invalid or expired session" when creating clients

Log out and log back in to refresh the JWT token.

### Client created but can't log in

Check that:
1. `email_confirm: true` was set when creating
2. Profile exists in `profiles` table
3. Profile has `active: true`
