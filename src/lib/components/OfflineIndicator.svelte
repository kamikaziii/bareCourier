<script lang="ts">
	import { browser } from '$app/environment';
	import { WifiOff, RefreshCw, Check, AlertTriangle } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	// Online/offline state
	let isOnline = $state(browser ? navigator.onLine : true);
	let isSyncing = $state(false);
	let showSyncComplete = $state(false);
	let showSyncFailed = $state(false);

	// Pending changes count (tracked via service worker messages)
	let pendingCount = $state(0);

	// Listen for online/offline events
	$effect(() => {
		if (!browser) return;

		function handleOnline() {
			isOnline = true;
			// When coming back online, if there are pending changes,
			// show syncing indicator (Background Sync API handles actual sync)
			if (pendingCount > 0) {
				isSyncing = true;
			}
		}

		function handleOffline() {
			isOnline = false;
			showSyncComplete = false;
		}

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});

	// Listen for service worker messages (unified event system)
	$effect(() => {
		if (!browser || !('serviceWorker' in navigator)) return;

		function handleSWMessage(event: MessageEvent) {
			if (event.data?.type === 'SYNC_COMPLETE') {
				// A sync completed successfully - decrement pending count
				pendingCount = Math.max(0, pendingCount - 1);
				if (pendingCount === 0) {
					isSyncing = false;
					showSyncComplete = true;
					setTimeout(() => {
						showSyncComplete = false;
					}, 2000);
				}
			} else if (event.data?.type === 'SYNC_QUEUED') {
				// A new request was queued for background sync
				pendingCount += 1;
			} else if (event.data?.type === 'SYNC_STATUS') {
				// Full sync status update from service worker
				pendingCount = event.data.pending || 0;
				isSyncing = event.data.syncing || false;
			} else if (event.data?.type === 'SYNC_FAILED_PERMANENT') {
				// A sync failed permanently (4xx error) - decrement pending and show failure
				pendingCount = Math.max(0, pendingCount - 1);
				isSyncing = pendingCount > 0;
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

	// Expose method to update pending count (for IndexedDB integration)
	export function updatePendingCount(count: number) {
		pendingCount = count;
	}

	// Visibility - show when offline, syncing, just synced, or sync failed
	const isVisible = $derived(!isOnline || isSyncing || showSyncComplete || showSyncFailed || pendingCount > 0);
</script>

{#if isVisible}
	<div
		class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300"
		class:bg-amber-500={!isOnline}
		class:text-amber-950={!isOnline}
		class:bg-blue-500={isSyncing}
		class:text-white={isSyncing || showSyncComplete}
		class:bg-green-500={showSyncComplete}
		class:bg-red-500={showSyncFailed}
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
		{:else if showSyncFailed}
			<AlertTriangle class="size-4" />
			<span>{m.offline_sync_failed()}</span>
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
