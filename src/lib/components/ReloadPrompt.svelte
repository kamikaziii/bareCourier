<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as m from '$lib/paraglide/messages.js';

	const AUTO_DISMISS_MS = 30000; // 30 seconds

	const {
		needRefresh,
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

	// Track if user dismissed the prompt (will show again on next navigation)
	let dismissed = $state(false);

	// Auto-dismiss after 30 seconds
	$effect(() => {
		if ($needRefresh && !dismissed) {
			const timer = setTimeout(() => {
				dismissed = true;
			}, AUTO_DISMISS_MS);

			return () => clearTimeout(timer);
		}
	});

	// Reset dismissed state when needRefresh changes (new update detected)
	let lastNeedRefresh = $state(false);
	$effect(() => {
		if ($needRefresh && !lastNeedRefresh) {
			// New update detected, reset dismissed state
			dismissed = false;
		}
		lastNeedRefresh = $needRefresh;
	});

	function close() {
		dismissed = true;
	}

	const showPrompt = $derived($needRefresh && !dismissed);
</script>

{#if showPrompt}
	<div
		class="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-background p-4 shadow-lg"
		role="alert"
	>
		<p class="mb-3 text-sm">{m.pwa_update_available()}</p>
		<div class="flex gap-2">
			<Button size="sm" onclick={() => updateServiceWorker(true)}>{m.pwa_refresh()}</Button>
			<Button size="sm" variant="outline" onclick={close}>{m.pwa_close()}</Button>
		</div>
	</div>
{/if}
