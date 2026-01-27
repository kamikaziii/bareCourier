<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { Package, PlusCircle, Receipt, Settings } from '@lucide/svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const suggestedServices = $derived(data.navCounts?.suggestedServices ?? 0);

	const navItems = $derived([
		{ href: '/client', label: m.nav_my_services(), icon: Package, badge: suggestedServices },
		{ href: '/client/new', label: m.nav_new_request(), icon: PlusCircle },
		{ href: '/client/billing', label: m.nav_billing(), icon: Receipt },
		{ href: '/client/settings', label: m.nav_settings(), icon: Settings }
	]);
</script>

<AppShell
	profile={data.profile}
	role="client"
	supabase={data.supabase}
	sidebarItems={navItems}
	bottomNavItems={navItems}
	sidebarCollapsed={data.sidebarCollapsed}
>
	{@render children()}
</AppShell>
