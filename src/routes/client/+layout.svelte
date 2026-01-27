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
	import { Package, PlusCircle, Receipt, Settings } from '@lucide/svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	async function handleLogout() {
		navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_AUTH_CACHE' });
		await data.supabase.auth.signOut();
		goto(localizeHref('/login'));
	}

	// Badge count for services awaiting response
	const suggestedServices = $derived(data.navCounts?.suggestedServices ?? 0);

	// All navigation items with icons (4 items for client)
	const navItems = $derived([
		{ href: '/client', label: m.nav_my_services(), icon: Package, badge: suggestedServices },
		{ href: '/client/new', label: m.nav_new_request(), icon: PlusCircle },
		{ href: '/client/billing', label: m.nav_billing(), icon: Receipt },
		{ href: '/client/settings', label: m.nav_settings(), icon: Settings }
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
	<Sidebar items={navItems} {currentPath} />

	<!-- Main content area -->
	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Header -->
		<header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
			<div class="flex h-14 items-center justify-between px-4">
				<div class="flex items-center gap-4">
					<a href={localizeHref('/client')} class="font-semibold">{m.app_name()}</a>
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
					{#if data.profile?.id}
						<NotificationBell supabase={data.supabase} userId={data.profile.id} userRole="client" />
					{/if}
					<span class="hidden text-sm text-muted-foreground sm:inline">{data.profile?.name}</span>
					<Button variant="ghost" size="sm" onclick={handleLogout}>
						{m.auth_logout()}
					</Button>
				</div>
			</div>
		</header>

		<!-- Main content -->
		<main class="flex-1 px-5 py-6 pb-24 md:pb-6">
			<div class="mx-auto max-w-6xl">
				{@render children()}
			</div>
		</main>
	</div>

	<!-- Mobile Bottom Navigation (no More drawer for client - only 4 items) -->
	<MobileBottomNav mainItems={navItems} {currentPath} />
</div>
