<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(async () => {
		if (!data.session) {
			goto('/login');
			return;
		}

		// Get user profile to determine role
		const { data: profile } = await data.supabase
			.from('profiles')
			.select('role')
			.eq('id', data.session.user.id)
			.single();

		if (profile?.role === 'courier') {
			goto('/courier');
		} else {
			goto('/client');
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="text-center">
		<h1 class="text-4xl font-bold text-foreground">bareCourier</h1>
		<p class="mt-2 text-muted-foreground">Loading...</p>
	</div>
</div>
