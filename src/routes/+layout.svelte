<script lang="ts">
	import '../app.css';
	import { invalidate, onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import ReloadPrompt from '$lib/components/ReloadPrompt.svelte';
	import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
	import LoadingBar from '$lib/components/LoadingBar.svelte';
	import { deLocalizeUrl } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	onMount(() => {
		const {
			data: { subscription }
		} = data.supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== data.session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => subscription.unsubscribe();
	});

	// View Transitions API support (progressive enhancement)
	onNavigate((navigation) => {
		// Check if browser supports View Transitions
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Get delocalized pathname for hreflang tags using Paraglide's proper function
	const basePathname = $derived(deLocalizeUrl(page.url).pathname);
</script>

<svelte:head>
	<!-- hreflang tags for SEO -->
	<link rel="alternate" hreflang="pt-PT" href="https://barecourier.vercel.app{basePathname}" />
	<link rel="alternate" hreflang="en" href="https://barecourier.vercel.app/en{basePathname}" />
	<link rel="alternate" hreflang="x-default" href="https://barecourier.vercel.app{basePathname}" />
</svelte:head>

<LoadingBar />

<!-- Skip link for keyboard navigation -->
<a href="#main-content" class="skip-link">{m.skip_to_content()}</a>

{#if browser}
	<OfflineIndicator />
{/if}

<Tooltip.Provider>
	<div id="main-content">
		{@render children()}
	</div>
</Tooltip.Provider>

{#if browser}
	<ReloadPrompt />
{/if}
