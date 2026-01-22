<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref, getLocale, deLocalizeUrl } from '$lib/paraglide/runtime.js';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	async function handleLogout() {
		await data.supabase.auth.signOut();
		goto(localizeHref('/login'));
	}

	const navItems = $derived([
		{ href: '/client', label: m.nav_my_services() },
		{ href: '/client/new', label: m.nav_new_request() }
	]);

	const locales = [
		{ code: 'pt-PT', label: 'PT' },
		{ code: 'en', label: 'EN' }
	] as const;

	const currentLocale = $derived(getLocale());

	// Get delocalized pathname for active state comparison
	const currentPath = $derived(deLocalizeUrl(page.url).pathname);
</script>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
		<div class="container flex h-14 items-center justify-between px-4">
			<div class="flex items-center gap-4">
				<a href={localizeHref('/client')} class="font-semibold">{m.app_name()}</a>
			</div>
			<div class="flex items-center gap-2">
				<!-- Language Switcher -->
				<div class="flex gap-1">
					{#each locales as locale (locale.code)}
						<a
							href={localizeHref(currentPath, { locale: locale.code })}
							data-sveltekit-reload
						>
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
					<NotificationBell supabase={data.supabase} userId={data.profile.id} />
				{/if}
				<span class="text-sm text-muted-foreground">{data.profile?.name}</span>
				<Button variant="ghost" size="sm" onclick={handleLogout}>
					{m.auth_logout()}
				</Button>
			</div>
		</div>
	</header>

	<!-- Navigation -->
	<nav class="border-b bg-muted/40">
		<div class="container flex gap-1 overflow-x-auto px-4 py-2">
			{#each navItems as item (item.href)}
				<a
					href={localizeHref(item.href)}
					class="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground {currentPath === item.href
						? 'bg-accent text-accent-foreground'
						: 'text-muted-foreground'}"
				>
					{item.label}
				</a>
			{/each}
		</div>
	</nav>

	<!-- Main content -->
	<main class="container px-4 py-6">
		{@render children()}
	</main>
</div>
