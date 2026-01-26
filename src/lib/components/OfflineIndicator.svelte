<script lang="ts">
	import { browser } from '$app/environment';
	import { WifiOff, RefreshCw, Check, AlertTriangle } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	// Online/offline state
	let isOnline = $state(browser ? navigator.onLine : true);
	let isSyncing = $state(false);
	let showSyncComplete = $state(false);
	let showSyncFailed = $state(false);

	// Track if we went offline (to know if sync might be needed on reconnect)
	let wasOffline = $state(false);

	// Listen for online/offline events
	$effect(() => {
		if (!browser) return;

		function handleOnline() {
			isOnline = true;
			// If we were offline, show syncing briefly while Background Sync runs
			if (wasOffline) {
				isSyncing = true;
				wasOffline = false;
				// Sync indicator will be hidden when SYNC_COMPLETE arrives,
				// or after timeout if no pending changes
				setTimeout(() => {
					if (isSyncing) {
						isSyncing = false;
					}
				}, 3000);
			}
		}

		function handleOffline() {
			isOnline = false;
			wasOffline = true;
			showSyncComplete = false;
			showSyncFailed = false;
		}

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});

	// Listen for service worker messages
	$effect(() => {
		if (!browser || !('serviceWorker' in navigator)) return;

		function handleSWMessage(event: MessageEvent) {
			if (event.data?.type === 'SYNC_COMPLETE') {
				// A sync completed successfully
				isSyncing = false;
				showSyncComplete = true;
				setTimeout(() => {
					showSyncComplete = false;
				}, 2000);
			} else if (event.data?.type === 'SYNC_FAILED_PERMANENT') {
				// A sync failed permanently (4xx error)
				isSyncing = false;
				showSyncFailed = true;
				setTimeout(() => {
					showSyncFailed = false;
				}, 3000);
			}
		}

		navigator.serviceWorker.addEventListener('message', handleSWMessage);

		return () => {
			navigator.serviceWorker.removeEventListener('message', handleSWMessage);
		};
	});

	// Visibility - show when offline, syncing, just synced, or sync failed
	const isVisible = $derived(!isOnline || isSyncing || showSyncComplete || showSyncFailed);
</script>

{#if isVisible}
	<div
		class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300"
		class:bg-amber-500={!isOnline}
		class:text-amber-950={!isOnline}
		class:bg-blue-500={isSyncing}
		class:text-white={isSyncing || showSyncComplete || showSyncFailed}
		class:bg-green-500={showSyncComplete}
		class:bg-red-500={showSyncFailed}
		role="status"
		aria-live="polite"
	>
		{#if !isOnline}
			<WifiOff class="size-4" />
			<span>{m.offline_banner()}</span>
		{:else if showSyncFailed}
			<AlertTriangle class="size-4" />
			<span>{m.offline_sync_failed()}</span>
		{:else if isSyncing}
			<RefreshCw class="size-4 animate-spin" />
			<span>{m.offline_syncing()}</span>
		{:else if showSyncComplete}
			<Check class="size-4" />
			<span>{m.offline_sync_complete()}</span>
		{/if}
	</div>
{/if}
