# Admin Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a super admin dashboard for developer support with data browsing, user impersonation, activity monitoring, and audit logging.

**Architecture:** New `/admin` route group with auth guard checking `profile.role === 'admin'`. Reuses existing AppShell pattern with admin-specific sidebar. Audit logging via PostgreSQL table with RLS. Impersonation via cookie-based session flag.

**Tech Stack:** SvelteKit, Svelte 5 runes, shadcn-svelte, Supabase (Postgres + RLS), Tailwind CSS v4

**Last Updated:** 2025-01-29 (Updated for codebase changes from PRs #6 and #7)

---

## Codebase Context (Updated)

Since the original plan was written, the following changes have been made:

- **Database types architecture**: Now uses split pattern with `database.generated.ts` (auto-generated) + `database.types.ts` (manual enrichments)
- **New tables**: `break_logs`, `daily_reviews`, `service_types`, `distribution_zones` (workload/type-based pricing)
- **New profile columns**: `workload_settings`, `timezone`, type-based pricing columns
- **New service columns**: `duration_minutes`, `service_type_id`, `distribution_zone_id`
- **i18n file paths**: Messages are at `messages/*.json` (not `src/lib/paraglide/messages/*.json`)

---

## Task 1: Database Migration - Role Constraint & Audit Log

**Files:**
- Create: `supabase/migrations/20260129150000_add_admin_role_and_audit_log.sql`
- Modify: `src/lib/database.types.ts` (add AuditLog type following existing pattern)

**Step 1: Create the migration file**

Create `supabase/migrations/20260129150000_add_admin_role_and_audit_log.sql`:

```sql
-- Add 'admin' to profiles role constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN ('courier', 'client', 'admin'));

-- Create audit_log table
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id) NOT NULL,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_target ON audit_log(target_table, target_id);
CREATE INDEX idx_audit_log_admin_id ON audit_log(admin_id);

-- RLS for audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
  );
$$;

-- Admin can read all audit logs
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT USING (public.is_admin());

-- Admin can insert audit logs
CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT WITH CHECK (public.is_admin());

-- Create feature_flags table (for Phase 2, but create now)
CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean DEFAULT false,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- RLS for feature_flags
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_flags_select ON feature_flags
  FOR SELECT USING (public.is_admin());

CREATE POLICY feature_flags_update ON feature_flags
  FOR UPDATE USING (public.is_admin());

CREATE POLICY feature_flags_insert ON feature_flags
  FOR INSERT WITH CHECK (public.is_admin());
```

**Step 2: Apply the migration**

Run: `supabase db push`
Expected: Migration applies successfully

**Step 3: Add TypeScript types to database.types.ts**

The codebase uses a split architecture. Add these types to `src/lib/database.types.ts` in the appropriate sections:

1. First, add to the enriched `Database` type (inside the `public.Tables` section, after `service_reschedule_history`):

```typescript
// In the Database type definition, add to public.Tables:
audit_log: GeneratedDatabase['public']['Tables']['audit_log'];
feature_flags: GeneratedDatabase['public']['Tables']['feature_flags'];
```

2. Then add convenience aliases at the bottom (after the existing aliases):

```typescript
// ─── Admin panel types ──────────────────────────────────────────────────────

export type AuditLog = {
  id: string;
  admin_id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
};

/** Profile shape returned by admin +layout.server.ts */
export type AdminLayoutProfile = {
  id: string;
  role: 'admin';
  name: string;
};
```

3. Update the `LayoutProfile` discriminated union:

```typescript
/** Discriminated union of layout profile shapes (discriminant: role) */
export type LayoutProfile = CourierLayoutProfile | ClientLayoutProfile | AdminLayoutProfile;
```

**Step 4: Regenerate database types**

Run: `pnpm run types:generate`
Expected: Types regenerated successfully

**Step 5: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add supabase/migrations/20260129150000_add_admin_role_and_audit_log.sql src/lib/database.types.ts
git commit -m "feat(admin): add admin role constraint and audit_log table"
```

---

## Task 2: Admin Auth Guard & Basic Layout

**Files:**
- Create: `src/routes/admin/+layout.server.ts`
- Create: `src/routes/admin/+layout.svelte`
- Modify: `src/lib/components/AppShell.svelte` (add 'admin' to role type)

**Step 1: Create the server layout with auth guard**

Create `src/routes/admin/+layout.server.ts`:

```typescript
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { Profile, AdminLayoutProfile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, cookies }) => {
	const { session, user } = await safeGetSession();

	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	const { data } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	const profile = data as Profile | null;

	if (!profile || profile.role !== 'admin') {
		// Redirect non-admins to their appropriate dashboard
		if (profile?.role === 'courier') {
			redirect(303, localizeHref('/courier'));
		} else {
			redirect(303, localizeHref('/client'));
		}
	}

	// Check for impersonation cookie
	const impersonatingUserId = cookies.get('impersonating_user_id');
	let impersonatedProfile: Profile | null = null;

	if (impersonatingUserId) {
		const { data: impersonatedData } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', impersonatingUserId)
			.single();
		impersonatedProfile = impersonatedData as Profile | null;
	}

	return {
		profile: {
			id: profile.id,
			role: 'admin' as const,
			name: profile.name
		} satisfies AdminLayoutProfile,
		impersonatedProfile
	};
};
```

**Step 2: Create the layout component**

Create `src/routes/admin/+layout.svelte`:

```svelte
<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import ImpersonationBanner from '$lib/components/ImpersonationBanner.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import {
		LayoutDashboard,
		Users,
		Package,
		ScrollText,
		Settings
	} from '@lucide/svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const allNavItems = $derived([
		{ href: '/admin', label: m.admin_dashboard?.() ?? 'Dashboard', icon: LayoutDashboard },
		{ href: '/admin/users', label: m.admin_users?.() ?? 'Users', icon: Users },
		{ href: '/admin/services', label: m.admin_services?.() ?? 'Services', icon: Package },
		{ href: '/admin/audit', label: m.admin_audit?.() ?? 'Audit Log', icon: ScrollText },
		{ href: '/admin/config', label: m.admin_config?.() ?? 'Config', icon: Settings }
	]);

	const bottomNavItems = $derived(allNavItems.slice(0, 4));
	const moreItems = $derived(allNavItems.slice(4));
</script>

{#if data.impersonatedProfile}
	<ImpersonationBanner
		userName={data.impersonatedProfile.name}
		userRole={data.impersonatedProfile.role}
	/>
{/if}

<AppShell
	profile={data.profile}
	role="admin"
	supabase={data.supabase}
	sidebarItems={allNavItems}
	{bottomNavItems}
	{moreItems}
>
	{@render children()}
</AppShell>
```

**Step 3: Update AppShell to support admin role**

Modify `src/lib/components/AppShell.svelte` line 24 to add admin to the role union:

```typescript
interface AppShellProps {
	profile: { id: string; name: string; role: string };
	role: 'courier' | 'client' | 'admin';
	supabase: SupabaseClient;
	sidebarItems: NavItem[];
	bottomNavItems: NavItem[];
	moreItems?: NavItem[];
	sidebarCollapsed?: boolean;
	children: Snippet;
}
```

**Step 4: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/routes/admin/+layout.server.ts src/routes/admin/+layout.svelte src/lib/components/AppShell.svelte
git commit -m "feat(admin): add auth guard and basic layout structure"
```

---

## Task 3: Impersonation Banner Component

**Files:**
- Create: `src/lib/components/ImpersonationBanner.svelte`

**Step 1: Create the banner component**

Create `src/lib/components/ImpersonationBanner.svelte`:

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { AlertTriangle, X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		userName: string;
		userRole: 'courier' | 'client';
	}

	let { userName, userRole }: Props = $props();

	async function exitImpersonation() {
		// Call API to clear impersonation cookie
		await fetch('/admin/api/impersonate', {
			method: 'DELETE'
		});
		// Redirect back to admin
		window.location.href = '/admin';
	}
</script>

<div class="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2">
	<div class="mx-auto max-w-6xl flex items-center justify-between">
		<div class="flex items-center gap-2">
			<AlertTriangle class="size-5" />
			<span class="font-medium">
				{m.admin_viewing_as?.() ?? 'Viewing as'} {userName}
				<span class="text-amber-800">({userRole})</span>
			</span>
		</div>
		<Button
			variant="ghost"
			size="sm"
			class="text-amber-950 hover:bg-amber-600 hover:text-amber-950"
			onclick={exitImpersonation}
		>
			<X class="size-4 mr-1" />
			{m.admin_exit_impersonation?.() ?? 'Exit'}
		</Button>
	</div>
</div>

<!-- Spacer to push content below the banner -->
<div class="h-10"></div>
```

**Step 2: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/components/ImpersonationBanner.svelte
git commit -m "feat(admin): add impersonation banner component"
```

---

## Task 4: Admin Dashboard Page

**Files:**
- Create: `src/routes/admin/+page.svelte`
- Create: `src/routes/admin/+page.server.ts`

**Step 1: Create the server load function**

Create `src/routes/admin/+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayStr = today.toISOString();

	// Fetch stats in parallel
	const [
		servicesCreatedToday,
		servicesDeliveredToday,
		pendingRequests,
		totalUsers,
		recentServices,
		recentAuditLogs
	] = await Promise.all([
		// Services created today
		supabase
			.from('services')
			.select('*', { count: 'exact', head: true })
			.gte('created_at', todayStr)
			.is('deleted_at', null),

		// Services delivered today
		supabase
			.from('services')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'delivered')
			.gte('delivered_at', todayStr)
			.is('deleted_at', null),

		// Pending requests
		supabase
			.from('services')
			.select('*', { count: 'exact', head: true })
			.eq('request_status', 'pending')
			.is('deleted_at', null),

		// Total active users
		supabase
			.from('profiles')
			.select('*', { count: 'exact', head: true })
			.eq('active', true),

		// Recent services (last 10)
		supabase
			.from('services')
			.select('id, pickup_location, delivery_location, status, created_at, profiles!client_id(name)')
			.is('deleted_at', null)
			.order('created_at', { ascending: false })
			.limit(10),

		// Recent audit logs (last 10)
		supabase
			.from('audit_log')
			.select('*, profiles!admin_id(name)')
			.order('created_at', { ascending: false })
			.limit(10)
	]);

	// Calculate anomalies
	const anomalies: Array<{ type: string; message: string; severity: 'warning' | 'error' }> = [];

	// Check for services pending > 48 hours
	const twoDaysAgo = new Date(today);
	twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

	const { count: stalePending } = await supabase
		.from('services')
		.select('*', { count: 'exact', head: true })
		.eq('status', 'pending')
		.lt('created_at', twoDaysAgo.toISOString())
		.is('deleted_at', null);

	if (stalePending && stalePending > 0) {
		anomalies.push({
			type: 'stale_pending',
			message: `${stalePending} services pending for more than 48 hours`,
			severity: 'warning'
		});
	}

	return {
		stats: {
			servicesCreatedToday: servicesCreatedToday.count ?? 0,
			servicesDeliveredToday: servicesDeliveredToday.count ?? 0,
			pendingRequests: pendingRequests.count ?? 0,
			totalUsers: totalUsers.count ?? 0
		},
		recentServices: recentServices.data ?? [],
		recentAuditLogs: recentAuditLogs.data ?? [],
		anomalies
	};
};
```

**Step 2: Create the dashboard page**

Create `src/routes/admin/+page.svelte`:

```svelte
<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import {
		Package,
		CheckCircle,
		Clock,
		Users,
		AlertTriangle,
		ChevronRight
	} from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">{m.admin_dashboard?.() ?? 'Admin Dashboard'}</h1>

	<!-- Stats Grid -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<div class="size-10 rounded-full bg-blue-500/10 flex items-center justify-center">
					<Package class="size-5 text-blue-500" />
				</div>
				<div>
					<p class="text-2xl font-bold">{data.stats.servicesCreatedToday}</p>
					<p class="text-sm text-muted-foreground">Created Today</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<div class="size-10 rounded-full bg-green-500/10 flex items-center justify-center">
					<CheckCircle class="size-5 text-green-500" />
				</div>
				<div>
					<p class="text-2xl font-bold">{data.stats.servicesDeliveredToday}</p>
					<p class="text-sm text-muted-foreground">Delivered Today</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<div class="size-10 rounded-full bg-amber-500/10 flex items-center justify-center">
					<Clock class="size-5 text-amber-500" />
				</div>
				<div>
					<p class="text-2xl font-bold">{data.stats.pendingRequests}</p>
					<p class="text-sm text-muted-foreground">Pending Requests</p>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<div class="size-10 rounded-full bg-purple-500/10 flex items-center justify-center">
					<Users class="size-5 text-purple-500" />
				</div>
				<div>
					<p class="text-2xl font-bold">{data.stats.totalUsers}</p>
					<p class="text-sm text-muted-foreground">Active Users</p>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Anomaly Alerts -->
	{#if data.anomalies.length > 0}
		<Card.Root class="border-amber-500/50">
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-amber-600">
					<AlertTriangle class="size-5" />
					Alerts
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2">
				{#each data.anomalies as anomaly (anomaly.type)}
					<div class="flex items-center gap-2 rounded-md bg-amber-500/10 p-3">
						<AlertTriangle class="size-4 text-amber-600" />
						<span class="text-sm">{anomaly.message}</span>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Recent Activity -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between">
				<Card.Title>Recent Services</Card.Title>
				<a href={localizeHref('/admin/services')} class="text-sm text-primary hover:underline">
					View all
					<ChevronRight class="inline size-4" />
				</a>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each data.recentServices as service (service.id)}
					<a href={localizeHref(`/admin/services/${service.id}`)} class="block">
						<div class="flex items-center justify-between rounded-md p-2 hover:bg-muted/50">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium">
									{service.profiles?.name ?? 'Unknown'}
								</p>
								<p class="truncate text-xs text-muted-foreground">
									{service.pickup_location} → {service.delivery_location}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<Badge variant={service.status === 'delivered' ? 'default' : 'secondary'}>
									{service.status}
								</Badge>
								<span class="text-xs text-muted-foreground">
									{formatDistanceToNow(new Date(service.created_at), { addSuffix: true })}
								</span>
							</div>
						</div>
					</a>
				{:else}
					<p class="text-sm text-muted-foreground">No recent services</p>
				{/each}
			</Card.Content>
		</Card.Root>

		<!-- Audit Log -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between">
				<Card.Title>Recent Admin Actions</Card.Title>
				<a href={localizeHref('/admin/audit')} class="text-sm text-primary hover:underline">
					View all
					<ChevronRight class="inline size-4" />
				</a>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each data.recentAuditLogs as log (log.id)}
					<div class="flex items-center justify-between rounded-md p-2">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium">{log.action}</p>
							<p class="text-xs text-muted-foreground">
								{log.profiles?.name ?? 'Unknown'} · {log.target_table}
							</p>
						</div>
						<span class="text-xs text-muted-foreground">
							{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
						</span>
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">No admin actions yet</p>
				{/each}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Quick Links -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Quick Links</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-wrap gap-2">
			<a href={localizeHref('/admin/users')} class="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-2 text-sm hover:bg-muted/80">
				<Users class="size-4" />
				Browse Users
			</a>
			<a href={localizeHref('/admin/services')} class="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-2 text-sm hover:bg-muted/80">
				<Package class="size-4" />
				Browse Services
			</a>
			<a href={localizeHref('/admin/audit')} class="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-2 text-sm hover:bg-muted/80">
				<Clock class="size-4" />
				Audit Log
			</a>
		</Card.Content>
	</Card.Root>
</div>
```

**Step 3: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/routes/admin/+page.svelte src/routes/admin/+page.server.ts
git commit -m "feat(admin): add activity dashboard with stats and alerts"
```

---

## Task 5: Users Browser Page

**Files:**
- Create: `src/routes/admin/users/+page.svelte`
- Create: `src/routes/admin/users/+page.server.ts`

**Step 1: Create the server load function**

Create `src/routes/admin/users/+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';
import type { Profile } from '$lib/database.types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	const roleFilter = url.searchParams.get('role') ?? 'all';
	const activeFilter = url.searchParams.get('active') ?? 'all';
	const search = url.searchParams.get('search') ?? '';

	let query = supabase
		.from('profiles')
		.select('*')
		.order('created_at', { ascending: false });

	// Apply role filter
	if (roleFilter !== 'all') {
		query = query.eq('role', roleFilter);
	}

	// Apply active filter
	if (activeFilter === 'active') {
		query = query.eq('active', true);
	} else if (activeFilter === 'inactive') {
		query = query.eq('active', false);
	}

	// Apply search
	if (search) {
		query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
	}

	const { data, error } = await query;

	if (error) {
		console.error('Error fetching users:', error);
	}

	return {
		users: (data as Profile[]) ?? [],
		filters: { role: roleFilter, active: activeFilter, search }
	};
};
```

**Step 2: Create the users browser page**

Create `src/routes/admin/users/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import { Search, ChevronRight, User } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.filters.search);
	let roleFilter = $state(data.filters.role);
	let activeFilter = $state(data.filters.active);

	function applyFilters() {
		const params = new URLSearchParams();
		if (searchInput) params.set('search', searchInput);
		if (roleFilter !== 'all') params.set('role', roleFilter);
		if (activeFilter !== 'all') params.set('active', activeFilter);

		const queryString = params.toString();
		goto(localizeHref(`/admin/users${queryString ? '?' + queryString : ''}`));
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			applyFilters();
		}
	}

	function getRoleBadgeVariant(role: string) {
		switch (role) {
			case 'admin': return 'default';
			case 'courier': return 'secondary';
			default: return 'outline';
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Users</h1>
		<Badge variant="secondary">{data.users.length} total</Badge>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="flex flex-wrap items-end gap-4 p-4">
			<div class="flex-1 min-w-[200px]">
				<label class="text-sm font-medium mb-1 block">Search</label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search by name or phone..."
						class="pl-9"
						bind:value={searchInput}
						onkeydown={handleSearchKeydown}
					/>
				</div>
			</div>

			<div class="w-[150px]">
				<label class="text-sm font-medium mb-1 block">Role</label>
				<Select.Root type="single" bind:value={roleFilter} onValueChange={applyFilters}>
					<Select.Trigger>
						{roleFilter === 'all' ? 'All roles' : roleFilter}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">All roles</Select.Item>
						<Select.Item value="admin">Admin</Select.Item>
						<Select.Item value="courier">Courier</Select.Item>
						<Select.Item value="client">Client</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>

			<div class="w-[150px]">
				<label class="text-sm font-medium mb-1 block">Status</label>
				<Select.Root type="single" bind:value={activeFilter} onValueChange={applyFilters}>
					<Select.Trigger>
						{activeFilter === 'all' ? 'All' : activeFilter === 'active' ? 'Active' : 'Inactive'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">All</Select.Item>
						<Select.Item value="active">Active</Select.Item>
						<Select.Item value="inactive">Inactive</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>

			<Button onclick={applyFilters}>Apply</Button>
		</Card.Content>
	</Card.Root>

	<!-- Users List -->
	<div class="space-y-3">
		{#each data.users as user (user.id)}
			<a href={localizeHref(`/admin/users/${user.id}`)} class="block">
				<Card.Root class="transition-colors hover:bg-muted/50">
					<Card.Content class="flex items-center justify-between p-4">
						<div class="flex items-center gap-3 min-w-0 flex-1">
							<div class="size-10 rounded-full bg-muted flex items-center justify-center">
								<User class="size-5 text-muted-foreground" />
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<p class="font-medium truncate">{user.name}</p>
									<Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
									{#if !user.active}
										<Badge variant="outline" class="text-muted-foreground">Inactive</Badge>
									{/if}
								</div>
								<p class="text-sm text-muted-foreground truncate">
									{user.phone || 'No phone'}
									{#if user.default_pickup_location}
										· {user.default_pickup_location}
									{/if}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-xs text-muted-foreground hidden sm:inline">
								{formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
							</span>
							<ChevronRight class="size-5 text-muted-foreground" />
						</div>
					</Card.Content>
				</Card.Root>
			</a>
		{:else}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					No users found
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
```

**Step 3: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/routes/admin/users/+page.svelte src/routes/admin/users/+page.server.ts
git commit -m "feat(admin): add users browser with search and filters"
```

---

## Task 6: User Detail Page with Impersonation

**Files:**
- Create: `src/routes/admin/users/[id]/+page.svelte`
- Create: `src/routes/admin/users/[id]/+page.server.ts`
- Create: `src/routes/admin/api/impersonate/+server.ts`

**Step 1: Create the server load function**

Create `src/routes/admin/users/[id]/+page.server.ts`:

```typescript
import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, Service } from '$lib/database.types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { id } = params;

	// Fetch user profile
	const { data: user, error: userError } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', id)
		.single();

	if (userError || !user) {
		throw error(404, 'User not found');
	}

	// Fetch service stats
	const [totalServices, pendingServices, deliveredServices, recentServices] = await Promise.all([
		supabase
			.from('services')
			.select('*', { count: 'exact', head: true })
			.eq('client_id', id)
			.is('deleted_at', null),
		supabase
			.from('services')
			.select('*', { count: 'exact', head: true })
			.eq('client_id', id)
			.eq('status', 'pending')
			.is('deleted_at', null),
		supabase
			.from('services')
			.select('*', { count: 'exact', head: true })
			.eq('client_id', id)
			.eq('status', 'delivered')
			.is('deleted_at', null),
		supabase
			.from('services')
			.select('*')
			.eq('client_id', id)
			.is('deleted_at', null)
			.order('created_at', { ascending: false })
			.limit(5)
	]);

	return {
		user: user as Profile,
		stats: {
			total: totalServices.count ?? 0,
			pending: pendingServices.count ?? 0,
			delivered: deliveredServices.count ?? 0
		},
		recentServices: (recentServices.data as Service[]) ?? []
	};
};

export const actions: Actions = {
	updateProfile: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const phone = formData.get('phone') as string;
		const default_pickup_location = formData.get('default_pickup_location') as string;
		const active = formData.get('active') === 'true';

		// Get old values for audit log
		const { data: oldProfile } = await supabase
			.from('profiles')
			.select('*')
			.eq('id', params.id)
			.single();

		// Update profile
		const { error: updateError } = await supabase
			.from('profiles')
			.update({
				name,
				phone: phone || null,
				default_pickup_location: default_pickup_location || null,
				active
			})
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		// Log the action
		await supabase.from('audit_log').insert({
			admin_id: user.id,
			action: 'update_profile',
			target_table: 'profiles',
			target_id: params.id,
			old_value: oldProfile,
			new_value: { name, phone, default_pickup_location, active }
		});

		return { success: true };
	}
};
```

**Step 2: Create the impersonation API endpoint**

Create `src/routes/admin/api/impersonate/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	// Verify admin role
	const { data: profile } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.single();

	if (profile?.role !== 'admin') {
		return json({ error: 'Not authorized' }, { status: 403 });
	}

	const { userId } = await request.json();

	// Verify target user exists and is not admin
	const { data: targetUser } = await supabase
		.from('profiles')
		.select('role, name')
		.eq('id', userId)
		.single();

	if (!targetUser) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	if (targetUser.role === 'admin') {
		return json({ error: 'Cannot impersonate other admins' }, { status: 403 });
	}

	// Set impersonation cookie (1 hour expiry)
	cookies.set('impersonating_user_id', userId, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		maxAge: 60 * 60 // 1 hour
	});

	// Log impersonation start
	await supabase.from('audit_log').insert({
		admin_id: user.id,
		action: 'impersonate_start',
		target_table: 'profiles',
		target_id: userId,
		metadata: { impersonated_user_name: targetUser.name }
	});

	return json({ success: true, redirectTo: `/${targetUser.role}` });
};

export const DELETE: RequestHandler = async ({ cookies, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const impersonatingUserId = cookies.get('impersonating_user_id');

	if (impersonatingUserId) {
		// Log impersonation end
		await supabase.from('audit_log').insert({
			admin_id: user.id,
			action: 'impersonate_end',
			target_table: 'profiles',
			target_id: impersonatingUserId
		});

		cookies.delete('impersonating_user_id', { path: '/' });
	}

	return json({ success: true });
};
```

**Step 3: Create the user detail page**

Create `src/routes/admin/users/[id]/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData, ActionData } from './$types';
	import {
		Package,
		Clock,
		CheckCircle,
		Eye,
		ArrowLeft,
		Save
	} from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let name = $state(data.user.name);
	let phone = $state(data.user.phone ?? '');
	let defaultPickupLocation = $state(data.user.default_pickup_location ?? '');
	let active = $state(data.user.active ?? true);
	let loading = $state(false);
	let impersonateLoading = $state(false);

	async function handleImpersonate() {
		if (data.user.role === 'admin') {
			alert('Cannot impersonate other admins');
			return;
		}

		impersonateLoading = true;

		const response = await fetch('/admin/api/impersonate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: data.user.id })
		});

		const result = await response.json();

		if (result.success) {
			window.location.href = localizeHref(result.redirectTo);
		} else {
			alert(result.error);
			impersonateLoading = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<a href={localizeHref('/admin/users')} class="text-muted-foreground hover:text-foreground">
			<ArrowLeft class="size-5" />
		</a>
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<h1 class="text-2xl font-bold">{data.user.name}</h1>
				<Badge>{data.user.role}</Badge>
				{#if !data.user.active}
					<Badge variant="outline">Inactive</Badge>
				{/if}
			</div>
			<p class="text-sm text-muted-foreground">
				Created {formatDistanceToNow(new Date(data.user.created_at), { addSuffix: true })}
			</p>
		</div>
		{#if data.user.role !== 'admin'}
			<Button onclick={handleImpersonate} disabled={impersonateLoading}>
				<Eye class="size-4 mr-2" />
				{impersonateLoading ? 'Starting...' : 'Impersonate'}
			</Button>
		{/if}
	</div>

	<!-- Stats -->
	{#if data.user.role === 'client'}
		<div class="grid gap-4 md:grid-cols-3">
			<Card.Root>
				<Card.Content class="flex items-center gap-3 p-4">
					<Package class="size-8 text-muted-foreground" />
					<div>
						<p class="text-2xl font-bold">{data.stats.total}</p>
						<p class="text-sm text-muted-foreground">Total Services</p>
					</div>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="flex items-center gap-3 p-4">
					<Clock class="size-8 text-blue-500" />
					<div>
						<p class="text-2xl font-bold">{data.stats.pending}</p>
						<p class="text-sm text-muted-foreground">Pending</p>
					</div>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="flex items-center gap-3 p-4">
					<CheckCircle class="size-8 text-green-500" />
					<div>
						<p class="text-2xl font-bold">{data.stats.delivered}</p>
						<p class="text-sm text-muted-foreground">Delivered</p>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}

	<!-- Edit Form -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Edit Profile</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if form?.success}
				<div class="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
					Profile updated successfully
				</div>
			{/if}
			{#if form?.error}
				<div class="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.error}
				</div>
			{/if}

			<form method="POST" action="?/updateProfile" use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}>
				<div class="space-y-4">
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="name">Name</Label>
							<Input id="name" name="name" bind:value={name} required />
						</div>
						<div class="space-y-2">
							<Label for="phone">Phone</Label>
							<Input id="phone" name="phone" type="tel" bind:value={phone} />
						</div>
					</div>

					{#if data.user.role === 'client'}
						<div class="space-y-2">
							<Label for="default_pickup_location">Default Pickup Location</Label>
							<Input
								id="default_pickup_location"
								name="default_pickup_location"
								bind:value={defaultPickupLocation}
							/>
						</div>
					{/if}

					<div class="flex items-center gap-2">
						<Switch id="active" checked={active} onCheckedChange={(checked) => active = checked} />
						<input type="hidden" name="active" value={active.toString()} />
						<Label for="active">Active</Label>
					</div>

					<Separator />

					<Button type="submit" disabled={loading}>
						<Save class="size-4 mr-2" />
						{loading ? 'Saving...' : 'Save Changes'}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- Recent Services -->
	{#if data.user.role === 'client' && data.recentServices.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>Recent Services</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each data.recentServices as service (service.id)}
					<a href={localizeHref(`/admin/services/${service.id}`)} class="block">
						<div class="flex items-center justify-between rounded-md p-2 hover:bg-muted/50">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm">
									{service.pickup_location} → {service.delivery_location}
								</p>
							</div>
							<Badge variant={service.status === 'delivered' ? 'default' : 'secondary'}>
								{service.status}
							</Badge>
						</div>
					</a>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
```

**Step 4: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/routes/admin/users/[id]/+page.svelte src/routes/admin/users/[id]/+page.server.ts src/routes/admin/api/impersonate/+server.ts
git commit -m "feat(admin): add user detail page with impersonation"
```

---

## Task 7: Services Browser Page

**Files:**
- Create: `src/routes/admin/services/+page.svelte`
- Create: `src/routes/admin/services/+page.server.ts`

**Step 1: Create the server load function**

Create `src/routes/admin/services/+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	const statusFilter = url.searchParams.get('status') ?? 'all';
	const requestStatusFilter = url.searchParams.get('request_status') ?? 'all';
	const clientFilter = url.searchParams.get('client') ?? 'all';
	const search = url.searchParams.get('search') ?? '';
	const dateFrom = url.searchParams.get('from') ?? '';
	const dateTo = url.searchParams.get('to') ?? '';

	// Fetch clients for filter dropdown
	const { data: clients } = await supabase
		.from('profiles')
		.select('id, name')
		.eq('role', 'client')
		.order('name');

	let query = supabase
		.from('services')
		.select('*, profiles!client_id(id, name)')
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	// Apply filters
	if (statusFilter !== 'all') {
		query = query.eq('status', statusFilter);
	}

	if (requestStatusFilter !== 'all') {
		query = query.eq('request_status', requestStatusFilter);
	}

	if (clientFilter !== 'all') {
		query = query.eq('client_id', clientFilter);
	}

	if (dateFrom) {
		query = query.gte('created_at', dateFrom);
	}

	if (dateTo) {
		query = query.lte('created_at', dateTo + 'T23:59:59');
	}

	if (search) {
		query = query.or(`pickup_location.ilike.%${search}%,delivery_location.ilike.%${search}%,notes.ilike.%${search}%`);
	}

	const { data, error } = await query.limit(100);

	if (error) {
		console.error('Error fetching services:', error);
	}

	return {
		services: data ?? [],
		clients: clients ?? [],
		filters: {
			status: statusFilter,
			request_status: requestStatusFilter,
			client: clientFilter,
			search,
			from: dateFrom,
			to: dateTo
		}
	};
};
```

**Step 2: Create the services browser page**

Create `src/routes/admin/services/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import { Search, ChevronRight, MapPin } from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';

	let { data }: { data: PageData } = $props();

	let searchInput = $state(data.filters.search);
	let statusFilter = $state(data.filters.status);
	let requestStatusFilter = $state(data.filters.request_status);
	let clientFilter = $state(data.filters.client);
	let dateFrom = $state(data.filters.from);
	let dateTo = $state(data.filters.to);

	function applyFilters() {
		const params = new URLSearchParams();
		if (searchInput) params.set('search', searchInput);
		if (statusFilter !== 'all') params.set('status', statusFilter);
		if (requestStatusFilter !== 'all') params.set('request_status', requestStatusFilter);
		if (clientFilter !== 'all') params.set('client', clientFilter);
		if (dateFrom) params.set('from', dateFrom);
		if (dateTo) params.set('to', dateTo);

		const queryString = params.toString();
		goto(localizeHref(`/admin/services${queryString ? '?' + queryString : ''}`));
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			applyFilters();
		}
	}

	function getStatusBadgeVariant(status: string) {
		return status === 'delivered' ? 'default' : 'secondary';
	}

	function getRequestStatusBadgeVariant(status: string) {
		switch (status) {
			case 'accepted': return 'default';
			case 'rejected': return 'destructive';
			case 'suggested': return 'outline';
			default: return 'secondary';
		}
	}

	function truncateId(id: string) {
		return id.slice(0, 8) + '...';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Services</h1>
		<Badge variant="secondary">{data.services.length} results</Badge>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="p-4">
			<div class="flex flex-wrap items-end gap-4">
				<div class="flex-1 min-w-[200px]">
					<label class="text-sm font-medium mb-1 block">Search</label>
					<div class="relative">
						<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<Input
							type="text"
							placeholder="Search locations or notes..."
							class="pl-9"
							bind:value={searchInput}
							onkeydown={handleSearchKeydown}
						/>
					</div>
				</div>

				<div class="w-[140px]">
					<label class="text-sm font-medium mb-1 block">Status</label>
					<Select.Root type="single" bind:value={statusFilter}>
						<Select.Trigger>
							{statusFilter === 'all' ? 'All' : statusFilter}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">All</Select.Item>
							<Select.Item value="pending">Pending</Select.Item>
							<Select.Item value="delivered">Delivered</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="w-[140px]">
					<label class="text-sm font-medium mb-1 block">Request</label>
					<Select.Root type="single" bind:value={requestStatusFilter}>
						<Select.Trigger>
							{requestStatusFilter === 'all' ? 'All' : requestStatusFilter}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">All</Select.Item>
							<Select.Item value="pending">Pending</Select.Item>
							<Select.Item value="accepted">Accepted</Select.Item>
							<Select.Item value="rejected">Rejected</Select.Item>
							<Select.Item value="suggested">Suggested</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="w-[180px]">
					<label class="text-sm font-medium mb-1 block">Client</label>
					<Select.Root type="single" bind:value={clientFilter}>
						<Select.Trigger>
							{clientFilter === 'all' ? 'All clients' : data.clients.find(c => c.id === clientFilter)?.name ?? 'Unknown'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">All clients</Select.Item>
							{#each data.clients as client (client.id)}
								<Select.Item value={client.id}>{client.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div class="flex flex-wrap items-end gap-4 mt-4">
				<div class="w-[150px]">
					<label class="text-sm font-medium mb-1 block">From</label>
					<Input type="date" bind:value={dateFrom} />
				</div>

				<div class="w-[150px]">
					<label class="text-sm font-medium mb-1 block">To</label>
					<Input type="date" bind:value={dateTo} />
				</div>

				<Button onclick={applyFilters}>Apply Filters</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Services List -->
	<div class="space-y-3">
		{#each data.services as service (service.id)}
			<a href={localizeHref(`/admin/services/${service.id}`)} class="block">
				<Card.Root class="transition-colors hover:bg-muted/50">
					<Card.Content class="p-4">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2 mb-1">
									<code class="text-xs text-muted-foreground">{truncateId(service.id)}</code>
									<span class="text-sm font-medium">{service.profiles?.name ?? 'Unknown'}</span>
								</div>
								<div class="flex items-start gap-2 text-sm text-muted-foreground">
									<MapPin class="size-4 mt-0.5 shrink-0" />
									<div class="min-w-0">
										<p class="truncate">{service.pickup_location}</p>
										<p class="truncate">→ {service.delivery_location}</p>
									</div>
								</div>
							</div>
							<div class="flex flex-col items-end gap-2">
								<div class="flex items-center gap-2">
									<Badge variant={getStatusBadgeVariant(service.status)}>
										{service.status}
									</Badge>
									{#if service.request_status}
										<Badge variant={getRequestStatusBadgeVariant(service.request_status)}>
											{service.request_status}
										</Badge>
									{/if}
								</div>
								<div class="flex items-center gap-2">
									{#if service.calculated_price}
										<span class="text-sm font-medium">€{service.calculated_price.toFixed(2)}</span>
									{/if}
									<span class="text-xs text-muted-foreground">
										{formatDistanceToNow(new Date(service.created_at), { addSuffix: true })}
									</span>
								</div>
							</div>
							<ChevronRight class="size-5 text-muted-foreground" />
						</div>
					</Card.Content>
				</Card.Root>
			</a>
		{:else}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					No services found
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
```

**Step 3: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/routes/admin/services/+page.svelte src/routes/admin/services/+page.server.ts
git commit -m "feat(admin): add services browser with filters"
```

---

## Task 8: Service Detail Page with Edits

**Files:**
- Create: `src/routes/admin/services/[id]/+page.svelte`
- Create: `src/routes/admin/services/[id]/+page.server.ts`

**Step 1: Create the server load function with actions**

Create `src/routes/admin/services/[id]/+page.server.ts`:

```typescript
import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service } from '$lib/database.types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { id } = params;

	// Fetch service with client info
	const { data: service, error: serviceError } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone)')
		.eq('id', id)
		.single();

	if (serviceError || !service) {
		throw error(404, 'Service not found');
	}

	// Fetch audit log for this service
	const { data: auditLogs } = await supabase
		.from('audit_log')
		.select('*, profiles!admin_id(name)')
		.eq('target_table', 'services')
		.eq('target_id', id)
		.order('created_at', { ascending: false });

	return {
		service: service as Service & { profiles: { id: string; name: string; phone: string | null } | null },
		auditLogs: auditLogs ?? []
	};
};

export const actions: Actions = {
	updateService: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const status = formData.get('status') as string;
		const delivered_at = formData.get('delivered_at') as string;
		const scheduled_date = formData.get('scheduled_date') as string;
		const scheduled_time_slot = formData.get('scheduled_time_slot') as string;
		const calculated_price = parseFloat(formData.get('calculated_price') as string);
		const notes = formData.get('notes') as string;

		// Get old values for audit log
		const { data: oldService } = await supabase
			.from('services')
			.select('*')
			.eq('id', params.id)
			.single();

		const updates: Record<string, unknown> = {
			status,
			notes: notes || null,
			scheduled_date: scheduled_date || null,
			scheduled_time_slot: scheduled_time_slot || null,
			calculated_price: isNaN(calculated_price) ? null : calculated_price
		};

		// Handle delivered_at based on status
		if (status === 'delivered' && !oldService?.delivered_at) {
			updates.delivered_at = delivered_at || new Date().toISOString();
		} else if (status === 'pending') {
			updates.delivered_at = null;
		}

		// Update service
		const { error: updateError } = await supabase
			.from('services')
			.update(updates)
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		// Log the action
		await supabase.from('audit_log').insert({
			admin_id: user.id,
			action: 'update_service',
			target_table: 'services',
			target_id: params.id,
			old_value: oldService,
			new_value: updates
		});

		return { success: true };
	},

	markDelivered: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const now = new Date().toISOString();

		const { data: oldService } = await supabase
			.from('services')
			.select('*')
			.eq('id', params.id)
			.single();

		const { error: updateError } = await supabase
			.from('services')
			.update({ status: 'delivered', delivered_at: now })
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		await supabase.from('audit_log').insert({
			admin_id: user.id,
			action: 'mark_delivered',
			target_table: 'services',
			target_id: params.id,
			old_value: { status: oldService?.status },
			new_value: { status: 'delivered', delivered_at: now }
		});

		return { success: true };
	},

	cancelService: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const now = new Date().toISOString();

		const { error: updateError } = await supabase
			.from('services')
			.update({ deleted_at: now })
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		await supabase.from('audit_log').insert({
			admin_id: user.id,
			action: 'cancel_service',
			target_table: 'services',
			target_id: params.id,
			new_value: { deleted_at: now }
		});

		return { success: true, cancelled: true };
	}
};
```

**Step 2: Create the service detail page**

Create `src/routes/admin/services/[id]/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData, ActionData } from './$types';
	import {
		ArrowLeft,
		Save,
		Check,
		X,
		MapPin,
		User,
		Clock
	} from '@lucide/svelte';
	import { formatDistanceToNow } from 'date-fns';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let status = $state(data.service.status);
	let scheduledDate = $state(data.service.scheduled_date ?? '');
	let scheduledTimeSlot = $state(data.service.scheduled_time_slot ?? '');
	let calculatedPrice = $state(data.service.calculated_price?.toString() ?? '');
	let notes = $state(data.service.notes ?? '');
	let loading = $state(false);

	$effect(() => {
		if (form?.cancelled) {
			goto(localizeHref('/admin/services'));
		}
	});
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<a href={localizeHref('/admin/services')} class="text-muted-foreground hover:text-foreground">
			<ArrowLeft class="size-5" />
		</a>
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<h1 class="text-2xl font-bold">Service Detail</h1>
				<Badge variant={data.service.status === 'delivered' ? 'default' : 'secondary'}>
					{data.service.status}
				</Badge>
			</div>
			<code class="text-sm text-muted-foreground">{data.service.id}</code>
		</div>
	</div>

	<!-- Read-only Info -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<User class="size-4" />
					Client
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<p class="font-medium">{data.service.profiles?.name ?? 'Unknown'}</p>
				<p class="text-sm text-muted-foreground">{data.service.profiles?.phone ?? 'No phone'}</p>
				<a
					href={localizeHref(`/admin/users/${data.service.client_id}`)}
					class="text-sm text-primary hover:underline"
				>
					View profile →
				</a>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<MapPin class="size-4" />
					Locations
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-2">
				<div>
					<p class="text-xs text-muted-foreground">Pickup</p>
					<p class="text-sm">{data.service.pickup_location}</p>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Delivery</p>
					<p class="text-sm">{data.service.delivery_location}</p>
				</div>
				{#if data.service.distance_km}
					<p class="text-xs text-muted-foreground">
						Distance: {data.service.distance_km.toFixed(1)} km
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Edit Form -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Edit Service</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if form?.success}
				<div class="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
					Service updated successfully
				</div>
			{/if}
			{#if form?.error}
				<div class="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.error}
				</div>
			{/if}

			<form method="POST" action="?/updateService" use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}>
				<div class="space-y-4">
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="status">Status</Label>
							<Select.Root type="single" bind:value={status}>
								<Select.Trigger>
									{status}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="pending">Pending</Select.Item>
									<Select.Item value="delivered">Delivered</Select.Item>
								</Select.Content>
							</Select.Root>
							<input type="hidden" name="status" value={status} />
						</div>

						<div class="space-y-2">
							<Label for="calculated_price">Price (€)</Label>
							<Input
								id="calculated_price"
								name="calculated_price"
								type="number"
								step="0.01"
								bind:value={calculatedPrice}
							/>
						</div>

						<div class="space-y-2">
							<Label for="scheduled_date">Scheduled Date</Label>
							<Input
								id="scheduled_date"
								name="scheduled_date"
								type="date"
								bind:value={scheduledDate}
							/>
						</div>

						<div class="space-y-2">
							<Label for="scheduled_time_slot">Time Slot</Label>
							<Select.Root type="single" bind:value={scheduledTimeSlot}>
								<Select.Trigger>
									{scheduledTimeSlot || 'Select...'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="">None</Select.Item>
									<Select.Item value="morning">Morning</Select.Item>
									<Select.Item value="afternoon">Afternoon</Select.Item>
									<Select.Item value="evening">Evening</Select.Item>
									<Select.Item value="specific">Specific</Select.Item>
								</Select.Content>
							</Select.Root>
							<input type="hidden" name="scheduled_time_slot" value={scheduledTimeSlot} />
						</div>
					</div>

					<div class="space-y-2">
						<Label for="notes">Notes</Label>
						<Textarea id="notes" name="notes" bind:value={notes} rows={3} />
					</div>

					<input type="hidden" name="delivered_at" value={data.service.delivered_at ?? ''} />

					<Separator />

					<div class="flex flex-wrap gap-2">
						<Button type="submit" disabled={loading}>
							<Save class="size-4 mr-2" />
							{loading ? 'Saving...' : 'Save Changes'}
						</Button>

						{#if data.service.status === 'pending'}
							<form method="POST" action="?/markDelivered" use:enhance>
								<Button type="submit" variant="outline">
									<Check class="size-4 mr-2" />
									Mark Delivered
								</Button>
							</form>
						{/if}

						<form method="POST" action="?/cancelService" use:enhance={() => {
							return async ({ update }) => {
								if (confirm('Are you sure you want to cancel this service?')) {
									await update();
								}
							};
						}}>
							<Button type="submit" variant="destructive">
								<X class="size-4 mr-2" />
								Cancel Service
							</Button>
						</form>
					</div>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- Audit Log -->
	{#if data.auditLogs.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Clock class="size-4" />
					Change History
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each data.auditLogs as log (log.id)}
					<div class="flex items-start justify-between rounded-md border p-3">
						<div>
							<p class="font-medium">{log.action}</p>
							<p class="text-sm text-muted-foreground">
								by {log.profiles?.name ?? 'Unknown'}
							</p>
							{#if log.new_value}
								<pre class="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(log.new_value, null, 2)}</pre>
							{/if}
						</div>
						<span class="text-xs text-muted-foreground">
							{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
						</span>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
```

**Step 3: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/routes/admin/services/[id]/+page.svelte src/routes/admin/services/[id]/+page.server.ts
git commit -m "feat(admin): add service detail page with edits and audit log"
```

---

## Task 9: Audit Log Viewer Page

**Files:**
- Create: `src/routes/admin/audit/+page.svelte`
- Create: `src/routes/admin/audit/+page.server.ts`

**Step 1: Create the server load function**

Create `src/routes/admin/audit/+page.server.ts`:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	const actionFilter = url.searchParams.get('action') ?? 'all';
	const tableFilter = url.searchParams.get('table') ?? 'all';
	const dateFrom = url.searchParams.get('from') ?? '';
	const dateTo = url.searchParams.get('to') ?? '';

	let query = supabase
		.from('audit_log')
		.select('*, profiles!admin_id(id, name)')
		.order('created_at', { ascending: false });

	if (actionFilter !== 'all') {
		query = query.eq('action', actionFilter);
	}

	if (tableFilter !== 'all') {
		query = query.eq('target_table', tableFilter);
	}

	if (dateFrom) {
		query = query.gte('created_at', dateFrom);
	}

	if (dateTo) {
		query = query.lte('created_at', dateTo + 'T23:59:59');
	}

	const { data, error } = await query.limit(200);

	if (error) {
		console.error('Error fetching audit logs:', error);
	}

	// Get distinct actions for filters
	const { data: actions } = await supabase
		.from('audit_log')
		.select('action')
		.order('action');

	const uniqueActions = [...new Set(actions?.map(a => a.action) ?? [])];

	return {
		logs: data ?? [],
		actions: uniqueActions,
		filters: { action: actionFilter, table: tableFilter, from: dateFrom, to: dateTo }
	};
};
```

**Step 2: Create the audit log page**

Create `src/routes/admin/audit/+page.svelte`:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import { ChevronDown, ChevronRight, ScrollText } from '@lucide/svelte';
	import { format } from 'date-fns';

	let { data }: { data: PageData } = $props();

	let actionFilter = $state(data.filters.action);
	let tableFilter = $state(data.filters.table);
	let dateFrom = $state(data.filters.from);
	let dateTo = $state(data.filters.to);
	let expandedIds = $state<Set<string>>(new Set());

	function toggleExpand(id: string) {
		const newSet = new Set(expandedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedIds = newSet;
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (actionFilter !== 'all') params.set('action', actionFilter);
		if (tableFilter !== 'all') params.set('table', tableFilter);
		if (dateFrom) params.set('from', dateFrom);
		if (dateTo) params.set('to', dateTo);

		const queryString = params.toString();
		goto(localizeHref(`/admin/audit${queryString ? '?' + queryString : ''}`));
	}

	function getActionBadgeVariant(action: string) {
		if (action.includes('delete') || action.includes('cancel')) return 'destructive';
		if (action.includes('impersonate')) return 'secondary';
		return 'outline';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Audit Log</h1>
		<Badge variant="secondary">{data.logs.length} entries</Badge>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="flex flex-wrap items-end gap-4 p-4">
			<div class="w-[180px]">
				<label class="text-sm font-medium mb-1 block">Action</label>
				<Select.Root type="single" bind:value={actionFilter}>
					<Select.Trigger>
						{actionFilter === 'all' ? 'All actions' : actionFilter}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">All actions</Select.Item>
						{#each data.actions as action (action)}
							<Select.Item value={action}>{action}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<div class="w-[150px]">
				<label class="text-sm font-medium mb-1 block">Table</label>
				<Select.Root type="single" bind:value={tableFilter}>
					<Select.Trigger>
						{tableFilter === 'all' ? 'All tables' : tableFilter}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">All tables</Select.Item>
						<Select.Item value="profiles">profiles</Select.Item>
						<Select.Item value="services">services</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>

			<div class="w-[150px]">
				<label class="text-sm font-medium mb-1 block">From</label>
				<Input type="date" bind:value={dateFrom} />
			</div>

			<div class="w-[150px]">
				<label class="text-sm font-medium mb-1 block">To</label>
				<Input type="date" bind:value={dateTo} />
			</div>

			<Button onclick={applyFilters}>Apply</Button>
		</Card.Content>
	</Card.Root>

	<!-- Logs List -->
	<div class="space-y-2">
		{#each data.logs as log (log.id)}
			<Card.Root>
				<button
					type="button"
					class="w-full text-left"
					onclick={() => toggleExpand(log.id)}
				>
					<Card.Content class="p-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								{#if expandedIds.has(log.id)}
									<ChevronDown class="size-4 text-muted-foreground" />
								{:else}
									<ChevronRight class="size-4 text-muted-foreground" />
								{/if}
								<Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge>
								<span class="text-sm">{log.profiles?.name ?? 'Unknown'}</span>
								{#if log.target_table}
									<span class="text-sm text-muted-foreground">
										on {log.target_table}
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<span class="text-xs text-muted-foreground">
									{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
								</span>
							</div>
						</div>

						{#if expandedIds.has(log.id)}
							<div class="mt-4 space-y-3 border-t pt-4">
								{#if log.target_id}
									<div>
										<p class="text-xs font-medium text-muted-foreground">Target ID</p>
										<code class="text-sm">{log.target_id}</code>
									</div>
								{/if}

								{#if log.old_value}
									<div>
										<p class="text-xs font-medium text-muted-foreground">Old Value</p>
										<pre class="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">{JSON.stringify(log.old_value, null, 2)}</pre>
									</div>
								{/if}

								{#if log.new_value}
									<div>
										<p class="text-xs font-medium text-muted-foreground">New Value</p>
										<pre class="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">{JSON.stringify(log.new_value, null, 2)}</pre>
									</div>
								{/if}

								{#if log.metadata}
									<div>
										<p class="text-xs font-medium text-muted-foreground">Metadata</p>
										<pre class="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
									</div>
								{/if}
							</div>
						{/if}
					</Card.Content>
				</button>
			</Card.Root>
		{:else}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					<ScrollText class="size-8 mx-auto mb-2 opacity-50" />
					No audit logs found
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
```

**Step 3: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/routes/admin/audit/+page.svelte src/routes/admin/audit/+page.server.ts
git commit -m "feat(admin): add audit log viewer with filters and expandable entries"
```

---

## Task 10: Add Admin i18n Messages

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

> **Note:** i18n files are at `messages/*.json`, not `src/lib/paraglide/messages/*.json`

**Step 1: Add English messages**

Add to the bottom of `messages/en.json` (before the closing `}`):

```json
	"admin_dashboard": "Admin Dashboard",
	"admin_users": "Users",
	"admin_services": "Services",
	"admin_audit": "Audit Log",
	"admin_config": "Config",
	"admin_viewing_as": "Viewing as",
	"admin_exit_impersonation": "Exit"
```

**Step 2: Add Portuguese messages**

Add to the bottom of `messages/pt-PT.json` (before the closing `}`):

```json
	"admin_dashboard": "Painel Admin",
	"admin_users": "Utilizadores",
	"admin_services": "Serviços",
	"admin_audit": "Registo de Ações",
	"admin_config": "Configuração",
	"admin_viewing_as": "A ver como",
	"admin_exit_impersonation": "Sair"
```

**Step 3: Verify build succeeds**

Run: `pnpm run build`
Expected: Build succeeds with new messages compiled

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(admin): add i18n messages for admin panel"
```

---

## Task 11: Update Root Page to Handle Admin Role

**Files:**
- Modify: `src/routes/+page.server.ts`

**Step 1: Update root redirect logic**

Add admin redirect case to `src/routes/+page.server.ts`. Find the existing role checks and add before the courier check:

```typescript
// Add this before the existing role checks
if (profile.role === 'admin') {
	redirect(303, localizeHref('/admin'));
}
```

The full redirect section should look like:

```typescript
// Redirect based on role
if (profile.role === 'admin') {
	redirect(303, localizeHref('/admin'));
} else if (profile.role === 'courier') {
	redirect(303, localizeHref('/courier'));
} else if (profile.role === 'client') {
	redirect(303, localizeHref('/client'));
}
```

**Step 2: Run type check**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/routes/+page.server.ts
git commit -m "feat(admin): redirect admin users to admin dashboard"
```

---

## Task 12: Create Admin User (Manual Step)

**Files:** None (database operation)

**Step 1: Create admin user via SQL**

Run this in Supabase SQL editor or via migration:

```sql
-- First, identify your user ID (or create a new auth user)
-- Then update their profile to admin role:
UPDATE profiles
SET role = 'admin'
WHERE id = 'YOUR_USER_ID_HERE';
```

**Step 2: Verify admin access**

1. Log in with the admin user
2. Navigate to `/admin`
3. Verify dashboard loads
4. Test impersonation on a client user

---

## Summary

This plan implements the admin panel in 12 tasks:

1. **Database migration** - Add admin role, audit_log table, feature_flags table
2. **Auth guard & layout** - Protect admin routes, set up sidebar
3. **Impersonation banner** - Visual indicator when impersonating
4. **Dashboard** - Stats, activity feed, anomaly alerts
5. **Users browser** - Search and filter all users
6. **User detail** - Edit profile, impersonate, view stats
7. **Services browser** - Search and filter all services
8. **Service detail** - Edit service, mark delivered, cancel, view audit history
9. **Audit log viewer** - Browse all admin actions with expandable details
10. **i18n messages** - Add English and Portuguese translations
11. **Root redirect** - Handle admin role in root page
12. **Create admin user** - Manual database step

Each task follows TDD principles where applicable and includes frequent commits.
