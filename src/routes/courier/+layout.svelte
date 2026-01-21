<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	async function handleLogout() {
		await data.supabase.auth.signOut();
		goto('/login');
	}

	const navItems = [
		{ href: '/courier', label: 'Dashboard' },
		{ href: '/courier/services', label: 'Services' },
		{ href: '/courier/clients', label: 'Clients' },
		{ href: '/courier/reports', label: 'Reports' }
	];
</script>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
		<div class="container flex h-14 items-center justify-between px-4">
			<div class="flex items-center gap-4">
				<a href="/courier" class="font-semibold">bareCourier</a>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-sm text-muted-foreground">{data.profile.name}</span>
				<Button variant="ghost" size="sm" onclick={handleLogout}>
					Logout
				</Button>
			</div>
		</div>
	</header>

	<!-- Navigation -->
	<nav class="border-b bg-muted/40">
		<div class="container flex gap-1 overflow-x-auto px-4 py-2">
			{#each navItems as item}
				<a
					href={item.href}
					class="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground {page.url
						.pathname === item.href
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
