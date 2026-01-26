<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import ReloadPrompt from '$lib/components/ReloadPrompt.svelte';
	import OfflineIndicator from '$lib/components/OfflineIndicator.svelte';
	import { deLocalizeUrl } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';

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

	// Get delocalized pathname for hreflang tags using Paraglide's proper function
	const basePathname = $derived(deLocalizeUrl(page.url).pathname);
</script>

<svelte:head>
	<!-- hreflang tags for SEO -->
	<link rel="alternate" hreflang="pt-PT" href="https://barecourier.vercel.app{basePathname}" />
	<link rel="alternate" hreflang="en" href="https://barecourier.vercel.app/en{basePathname}" />
	<link rel="alternate" hreflang="x-default" href="https://barecourier.vercel.app{basePathname}" />
</svelte:head>

<!-- Skip link for keyboard navigation -->
<a href="#main-content" class="skip-link">{m.skip_to_content()}</a>

{#if browser}
	<OfflineIndicator />
{/if}

<div id="main-content">
	{@render children()}
</div>

{#if browser}
	<ReloadPrompt />
{/if}
