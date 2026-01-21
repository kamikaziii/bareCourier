<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as m from '$lib/paraglide/messages.js';

	const {
		needRefresh,
		offlineReady,
		updateServiceWorker
	} = useRegisterSW({
		onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
			console.log(`SW registered: ${swUrl}`);
			// Check for updates every hour
			if (registration) {
				setInterval(() => {
					registration.update();
				}, 60 * 60 * 1000);
			}
		},
		onRegisterError(error: Error) {
			console.error('SW registration error:', error);
		}
	});

	function close() {
		$offlineReady = false;
		$needRefresh = false;
	}
</script>

{#if $needRefresh || $offlineReady}
	<div
		class="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-background p-4 shadow-lg"
		role="alert"
	>
		{#if $offlineReady}
			<p class="mb-3 text-sm">{m.pwa_offline_ready()}</p>
		{:else}
			<p class="mb-3 text-sm">{m.pwa_update_available()}</p>
		{/if}
		<div class="flex gap-2">
			{#if $needRefresh}
				<Button size="sm" onclick={() => updateServiceWorker(true)}>{m.pwa_refresh()}</Button>
			{/if}
			<Button size="sm" variant="outline" onclick={close}>{m.pwa_close()}</Button>
		</div>
	</div>
{/if}
