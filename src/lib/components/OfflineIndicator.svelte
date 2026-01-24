<script lang="ts">
	import { browser } from '$app/environment';
	import { WifiOff, RefreshCw, Check } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	// Online/offline state
	let isOnline = $state(browser ? navigator.onLine : true);
	let isSyncing = $state(false);
	let showSyncComplete = $state(false);

	// Pending changes count (will be updated from IndexedDB when implemented)
	let pendingCount = $state(0);

	// Listen for online/offline events
	$effect(() => {
		if (!browser) return;

		function handleOnline() {
			isOnline = true;
			// Trigger sync when coming back online
			if (pendingCount > 0) {
				isSyncing = true;
				// Sync will be handled by Background Sync API
				// This is just a visual indicator
				setTimeout(() => {
					isSyncing = false;
					showSyncComplete = true;
					setTimeout(() => {
						showSyncComplete = false;
					}, 2000);
				}, 1500);
			}
		}

		function handleOffline() {
			isOnline = false;
			showSyncComplete = false;
		}

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		// Listen for custom sync events from service worker
		function handleSyncUpdate(event: CustomEvent) {
			pendingCount = event.detail.pending || 0;
		}
		window.addEventListener('sync-update', handleSyncUpdate as EventListener);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener('sync-update', handleSyncUpdate as EventListener);
		};
	});

	// Expose method to update pending count (for IndexedDB integration)
	export function updatePendingCount(count: number) {
		pendingCount = count;
	}

	// Visibility - show when offline, syncing, or just synced
	const isVisible = $derived(!isOnline || isSyncing || showSyncComplete || pendingCount > 0);
</script>

{#if isVisible}
	<div
		class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300"
		class:bg-amber-500={!isOnline}
		class:text-amber-950={!isOnline}
		class:bg-blue-500={isSyncing}
		class:text-white={isSyncing || showSyncComplete}
		class:bg-green-500={showSyncComplete}
		role="status"
		aria-live="polite"
	>
		{#if !isOnline}
			<WifiOff class="size-4" />
			<span>
				{m.offline_banner()}
				{#if pendingCount > 0}
					- {m.offline_pending({ count: pendingCount.toString() })}
				{/if}
			</span>
		{:else if isSyncing}
			<RefreshCw class="size-4 animate-spin" />
			<span>{m.offline_syncing()}</span>
		{:else if showSyncComplete}
			<Check class="size-4" />
			<span>{m.offline_sync_complete()}</span>
		{:else if pendingCount > 0}
			<RefreshCw class="size-4" />
			<span>{m.offline_pending({ count: pendingCount.toString() })}</span>
		{/if}
	</div>
{/if}
