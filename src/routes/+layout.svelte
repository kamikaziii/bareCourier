<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { LayoutData } from './$types';
	import ReloadPrompt from '$lib/components/ReloadPrompt.svelte';

	let { data, children }: { data: LayoutData; children: any } = $props();

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
</script>

{@render children()}

{#if browser}
	<ReloadPrompt />
{/if}
