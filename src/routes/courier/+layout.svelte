<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import {
		LayoutDashboard,
		Package,
		Inbox,
		Calendar,
		Users,
		Receipt,
		BarChart3,
		Settings
	} from '@lucide/svelte';
	import type { NavItem } from '$lib/types/navigation.js';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const allNavItems: NavItem[] = $derived([
		{ href: '/courier', label: m.nav_dashboard(), icon: LayoutDashboard },
		{ href: '/courier/services', label: m.nav_services(), icon: Package },
		{ href: '/courier/requests', label: m.nav_requests(), icon: Inbox, badge: data.navCounts?.pendingRequests },
		{ href: '/courier/calendar', label: m.nav_calendar(), icon: Calendar },
		{ href: '/courier/clients', label: m.nav_clients(), icon: Users },
		{ href: '/courier/billing', label: m.nav_billing(), icon: Receipt },
		{ href: '/courier/insights', label: m.nav_insights(), icon: BarChart3 },
		{ href: '/courier/settings', label: m.nav_settings(), icon: Settings }
	]);

	const bottomNavItems = $derived(allNavItems.slice(0, 4));
	const moreItems = $derived(allNavItems.slice(4));
</script>

<AppShell
	profile={data.profile}
	role="courier"
	supabase={data.supabase}
	sidebarItems={allNavItems}
	{bottomNavItems}
	{moreItems}
	sidebarCollapsed={data.sidebarCollapsed}
>
	{@render children()}
</AppShell>
