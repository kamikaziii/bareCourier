<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MobileBottomNav from '$lib/components/MobileBottomNav.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref, getLocale, deLocalizeUrl } from '$lib/paraglide/runtime.js';
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

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	async function handleLogout() {
		await data.supabase.auth.signOut();
		goto(localizeHref('/login'));
	}

	// Badge count for requests
	const pendingRequests = $derived(data.navCounts?.pendingRequests ?? 0);

	// All navigation items with icons (for sidebar)
	const allNavItems = $derived([
		{ href: '/courier', label: m.nav_dashboard(), icon: LayoutDashboard },
		{ href: '/courier/services', label: m.nav_services(), icon: Package },
		{ href: '/courier/requests', label: m.nav_requests(), icon: Inbox, badge: pendingRequests },
		{ href: '/courier/calendar', label: m.nav_calendar(), icon: Calendar },
		{ href: '/courier/clients', label: m.nav_clients(), icon: Users },
		{ href: '/courier/billing', label: m.nav_billing(), icon: Receipt },
		{ href: '/courier/insights', label: m.nav_insights(), icon: BarChart3 },
		{ href: '/courier/settings', label: m.nav_settings(), icon: Settings }
	]);

	// Bottom nav items (5 items shown directly)
	const bottomNavItems = $derived([
		{ href: '/courier', label: m.nav_dashboard(), icon: LayoutDashboard },
		{ href: '/courier/services', label: m.nav_services(), icon: Package },
		{ href: '/courier/requests', label: m.nav_requests(), icon: Inbox, badge: pendingRequests },
		{ href: '/courier/calendar', label: m.nav_calendar(), icon: Calendar }
	]);

	// Items that go in the "More" drawer
	const moreItems = $derived([
		{ href: '/courier/clients', label: m.nav_clients(), icon: Users },
		{ href: '/courier/billing', label: m.nav_billing(), icon: Receipt },
		{ href: '/courier/insights', label: m.nav_insights(), icon: BarChart3 },
		{ href: '/courier/settings', label: m.nav_settings(), icon: Settings }
	]);

	const locales = [
		{ code: 'pt-PT', label: 'PT' },
		{ code: 'en', label: 'EN' }
	] as const;

	const currentLocale = $derived(getLocale());

	// Get delocalized pathname for active state comparison
	const currentPath = $derived(deLocalizeUrl(page.url).pathname);
</script>

<div class="flex min-h-screen bg-background">
	<!-- Desktop Sidebar -->
	<Sidebar items={allNavItems} {currentPath} />

	<!-- Main content area -->
	<div class="flex flex-1 flex-col">
		<!-- Header -->
		<header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
			<div class="flex h-14 items-center justify-between px-4">
				<div class="flex items-center gap-4">
					<a href={localizeHref('/courier')} class="font-semibold">{m.app_name()}</a>
				</div>
				<div class="flex items-center gap-2">
					<!-- Language Switcher -->
					<div class="flex gap-1">
						{#each locales as locale (locale.code)}
							<a href={localizeHref(currentPath, { locale: locale.code })} data-sveltekit-reload>
								<Button
									variant={currentLocale === locale.code ? 'default' : 'ghost'}
									size="sm"
									class="px-2"
								>
									{locale.label}
								</Button>
							</a>
						{/each}
					</div>
					<NotificationBell supabase={data.supabase} userId={data.profile.id} userRole="courier" />
					<span class="hidden text-sm text-muted-foreground sm:inline">{data.profile.name}</span>
					<Button variant="ghost" size="sm" onclick={handleLogout}>
						{m.auth_logout()}
					</Button>
				</div>
			</div>
		</header>

		<!-- Main content -->
		<main class="flex-1 px-4 py-6 pb-24 md:pb-6">
			<div class="mx-auto max-w-6xl">
				{@render children()}
			</div>
		</main>
	</div>

	<!-- Mobile Bottom Navigation -->
	<MobileBottomNav mainItems={bottomNavItems} {moreItems} {currentPath} />
</div>
