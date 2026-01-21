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
  default_pickup_location text,  -- Client's default lab address
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
  delivered_at timestamptz  -- Set when status changes to 'delivered'
)
```

## Row Level Security (RLS)

### profiles table

| Policy | Operation | Rule |
|--------|-----------|------|
| Courier can read all | SELECT | `role = 'courier'` |
| Users can read own | SELECT | `id = auth.uid()` |
| Courier can create | INSERT | Courier creates client profiles |
| Courier can update all | UPDATE | `role = 'courier'` |
| Users can update own | UPDATE | `id = auth.uid()` |

### services table

| Policy | Operation | Rule |
|--------|-----------|------|
| Courier can read all | SELECT | `role = 'courier'` |
| Clients can read own | SELECT | `client_id = auth.uid()` |
| Clients can create own | INSERT | `client_id = auth.uid()` |
| Courier can create any | INSERT | `role = 'courier'` |
| Courier can update any | UPDATE | `role = 'courier'` |

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
2. Apply via Supabase MCP:
   ```
   mcp__supabase__apply_migration(name: "description", query: "SQL...")
   ```
3. Update `src/lib/database.types.ts` with new types

### Migration naming
- `001_initial_schema.sql`
- `002_add_field_to_table.sql`
- `003_create_new_table.sql`

### Best practices
- Never modify existing migrations in production
- Always include both `up` and consider rollback strategy
- Test RLS policies after changes
- Run `mcp__supabase__get_advisors(type: "security")` to check for issues

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
