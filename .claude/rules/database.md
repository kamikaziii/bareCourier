---
paths:
  - "supabase/**/*.sql"
  - "src/lib/database.types.ts"
  - "src/**/+page.server.ts"
  - "src/**/+layout.server.ts"
---

# Database Rules

## Schema Overview

### profiles
Extends Supabase `auth.users`. Created automatically via trigger on signup.

```sql
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('courier', 'client')),
  name text NOT NULL,
  phone text,
  default_pickup_location text,  -- Client's default address
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)
```

### services
Pickup/delivery jobs.

```sql
services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pickup_location text NOT NULL,
  delivery_location text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
  notes text,
  created_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  deleted_at timestamptz,              -- Soft delete
  updated_at timestamptz,

  -- Scheduling
  requested_date date,                 -- Client's requested date
  requested_time_slot text,            -- morning/afternoon/evening/specific
  scheduled_date date,                 -- Courier's confirmed date
  scheduled_time_slot text,
  request_status text DEFAULT 'pending' CHECK (request_status IN ('pending', 'accepted', 'rejected', 'suggested')),
  suggested_date date,                 -- Courier's counter-proposal
  suggested_time_slot text,

  -- Location (GPS)
  pickup_lat float8, pickup_lng float8,
  delivery_lat float8, delivery_lng float8,
  distance_km float8,

  -- Pricing
  urgency_fee_id uuid REFERENCES urgency_fees(id),
  calculated_price numeric,
  price_breakdown jsonb
)
```

## Row Level Security (RLS)

All policies use `(select auth.uid())` for optimal performance (prevents re-evaluation per row).

### profiles table

| Policy | Operation | Rule |
|--------|-----------|------|
| profiles_select | SELECT | Own profile OR courier can read all |
| profiles_insert | INSERT | Courier only (creates client profiles) |
| profiles_update | UPDATE | Own profile OR courier can update all |

### services table

| Policy | Operation | Rule |
|--------|-----------|------|
| services_select | SELECT | Own services OR courier can read all |
| services_insert | INSERT | Own services OR courier can create any |
| services_update | UPDATE | Courier only |

⚠️ **RLS Silent Failure Warning**: When RLS blocks an UPDATE, Supabase returns success with 0 rows affected (no error). Debug with:
```sql
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'services';
```

## Query Patterns

### Get profile with type safety
```typescript
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

const profile = data as Profile | null;
```

### Get services with client info
```typescript
const { data } = await supabase
  .from('services')
  .select('*, profiles!client_id(id, name)')
  .order('created_at', { ascending: false });
```

### Filter by date range
```typescript
const { data } = await supabase
  .from('services')
  .select('*')
  .gte('created_at', startDate.toISOString())
  .lt('created_at', endDate.toISOString());
```

### Update service status
```typescript
await supabase
  .from('services')
  .update({
    status: 'delivered',
    delivered_at: new Date().toISOString()
  })
  .eq('id', serviceId);
```

## TypeScript Types

Located in `src/lib/database.types.ts`:

```typescript
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Service = Database['public']['Tables']['services']['Row'];
export type NewService = Database['public']['Tables']['services']['Insert'];
```

### Usage
```typescript
import type { Profile, Service } from '$lib/database.types';

let profile: Profile | null = null;
let services: Service[] = [];
```

## Migration Guidelines

### Creating new migrations
1. Create file: `supabase/migrations/NNN_description.sql`
2. Apply: `supabase db push`
3. Update `src/lib/database.types.ts` with new types

### Migration naming
- `001_initial_schema.sql`
- `002_add_field_to_table.sql`
- `003_create_new_table.sql`

### Best practices
- Never modify existing migrations in production
- Always include both `up` and consider rollback strategy
- Test RLS policies after changes
- Run `supabase inspect db lint` to check for issues

## Indexes

Current indexes for performance:
```sql
idx_services_client_id    -- Fast lookups by client
idx_services_status       -- Filter by status
idx_services_created_at   -- Sort by date
idx_profiles_role         -- Filter by role
```

## Auto-Profile Creation

A trigger automatically creates a profile when a user signs up:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

The trigger reads `role` and `name` from `raw_user_meta_data`:
```typescript
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      name: 'Client Name',
      role: 'client'  // or 'courier'
    }
  }
});
```
