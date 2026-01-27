<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MobileBottomNav from '$lib/components/MobileBottomNav.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref, getLocale, deLocalizeUrl } from '$lib/paraglide/runtime.js';
	import type { Snippet } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';

	interface NavItem {
		href: string;
		label: string;
		icon: any;
		badge?: number;
	}

	interface AppShellProps {
		profile: { id: string; name: string; role: string };
		role: 'courier' | 'client';
		supabase: SupabaseClient;
		sidebarItems: NavItem[];
		bottomNavItems: NavItem[];
		moreItems?: NavItem[];
		children: Snippet;
	}

	let {
		profile,
		role,
		supabase,
		sidebarItems,
		bottomNavItems,
		moreItems = [],
		children
	}: AppShellProps = $props();

	async function handleLogout() {
		navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_AUTH_CACHE' });
		await supabase.auth.signOut();
		goto(localizeHref('/login'));
	}

	const locales = [
		{ code: 'pt-PT', label: 'PT' },
		{ code: 'en', label: 'EN' }
	] as const;

	const currentLocale = $derived(getLocale());
	const currentPath = $derived(deLocalizeUrl(page.url).pathname);
	const homeHref = $derived(`/${role}`);
</script>

<div class="flex min-h-screen bg-background">
	<!-- Desktop Sidebar -->
	<Sidebar items={sidebarItems} {currentPath} />

	<!-- Main content area -->
	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Header -->
		<header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
			<div class="flex h-14 items-center justify-between px-4">
				<div class="flex items-center gap-4">
					<a href={localizeHref(homeHref)} class="font-semibold">{m.app_name()}</a>
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
					{#if profile?.id}
						<NotificationBell {supabase} userId={profile.id} userRole={role} />
					{/if}
					<span class="hidden text-sm text-muted-foreground sm:inline">{profile?.name}</span>
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

	<!-- Mobile Bottom Navigation -->
	<MobileBottomNav mainItems={bottomNavItems} {moreItems} {currentPath} />
</div>
