/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

// Supabase Auth - Never cache
registerRoute(
	/^https:\/\/.*\.supabase\.co\/auth\/.*/i,
	new NetworkOnly()
);

// Background sync plugin for service status changes
const statusSyncPlugin = new BackgroundSyncPlugin('statusChangeQueue', {
	maxRetentionTime: 24 * 60, // Retry for 24 hours (in minutes)
	onSync: async ({ queue }) => {
		let entry;
		const failedEntries: typeof entry[] = [];

		// Process all items currently in queue
		while ((entry = await queue.shiftRequest())) {
			try {
				const response = await fetch(entry.request.clone());
				if (!response.ok) {
					// Detect permanent failures (4xx) - don't retry these
					if (response.status >= 400 && response.status < 500) {
						console.error('[SW] Permanent sync failure:', response.status, entry.request.url);
						notifyClients({
							type: 'SYNC_FAILED_PERMANENT',
							url: entry.request.url,
							status: response.status
						});
						continue; // Don't re-queue - permanent failure
					}

					// 5xx errors - temporary failure, save for re-queue after loop
					console.warn('[SW] Temporary sync failure:', response.status, entry.request.url);
					failedEntries.push(entry);
					continue; // Process remaining items
				}
				console.log('[SW] Synced:', entry.request.url);
				// Notify clients of successful sync
				notifyClients({ type: 'SYNC_COMPLETE', url: entry.request.url });
			} catch (error) {
				// Network errors - temporary failure, save for re-queue after loop
				console.error('[SW] Sync failed (network error):', error);
				failedEntries.push(entry);
				continue; // Process remaining items
			}
		}

		// Re-queue failed entries for retry (after processing all items)
		for (const failed of failedEntries) {
			await queue.unshiftRequest(failed);
		}

		// If any temporary failures occurred, throw to signal Workbox to schedule retry
		// This ensures the browser uses exponential backoff for retries
		if (failedEntries.length > 0) {
			throw new Error(`${failedEntries.length} request(s) failed temporarily and were re-queued for retry`);
		}
	}
});

// Helper to notify all clients
async function notifyClients(message: Record<string, unknown>) {
	const clients = await self.clients.matchAll({ type: 'window' });
	clients.forEach((client) => client.postMessage(message));
}

// Supabase REST API PATCH requests (status changes) - NetworkOnly with Background Sync
registerRoute(
	({ url, request }) =>
		url.hostname.includes('supabase.co') &&
		url.pathname.includes('/rest/') &&
		url.pathname.includes('/services') &&
		request.method === 'PATCH',
	new NetworkOnly({
		plugins: [statusSyncPlugin]
	}),
	'PATCH'
);

// Supabase REST API POST requests (service creation) - NetworkOnly with Background Sync
registerRoute(
	({ url, request }) =>
		url.hostname.includes('supabase.co') &&
		url.pathname.includes('/rest/') &&
		url.pathname.includes('/services') &&
		request.method === 'POST',
	new NetworkOnly({
		plugins: [statusSyncPlugin]
	}),
	'POST'
);

// Supabase REST API - NetworkFirst with cache fallback
registerRoute(
	/^https:\/\/.*\.supabase\.co\/rest\/.*/i,
	new NetworkFirst({
		cacheName: 'supabase-data',
		networkTimeoutSeconds: 10,
		plugins: [
			new ExpirationPlugin({
				maxEntries: 100,
				maxAgeSeconds: 60 * 60 * 24 // 24 hours
			})
			// CacheableResponsePlugin removed - uses default [0, 200]
		]
	})
);

// Mapbox tiles - CacheFirst
registerRoute(
	/^https:\/\/api\.mapbox\.com\/.*/i,
	new CacheFirst({
		cacheName: 'mapbox-tiles',
		plugins: [
			new ExpirationPlugin({
				maxEntries: 500,
				maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
			})
			// CacheableResponsePlugin removed - uses safe default [200]
		]
	})
);

// Push notification handling
self.addEventListener('push', (event) => {
	if (!event.data) return;

	let data;
	try {
		data = event.data.json();
	} catch (error) {
		console.error('[SW] Failed to parse push notification:', error);
		return;
	}

	const options: NotificationOptions = {
		body: data.message || data.body,
		icon: '/pwa-192x192.png',
		badge: '/pwa-64x64.png',
		data: {
			url: data.url || '/',
			serviceId: data.service_id
		}
	};

	event.waitUntil(self.registration.showNotification(data.title || 'bareCourier', options));
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	if (event.action === 'dismiss') {
		return;
	}

	const url = event.notification.data?.url || '/';

	// Validate URL is same-origin to prevent malicious redirects
	let safeUrl: string;
	try {
		const parsedUrl = new URL(url, self.location.origin);
		if (parsedUrl.origin !== self.location.origin) {
			console.warn('[SW] Blocked navigation to external URL:', url);
			return;
		}
		// Use only path and search to ensure same-origin
		safeUrl = parsedUrl.pathname + parsedUrl.search;
	} catch {
		console.warn('[SW] Invalid URL in notification:', url);
		return;
	}

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// Try to focus an existing window
			for (const client of clientList) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					client.navigate(safeUrl);
					return client.focus();
				}
			}
			// Open new window if none exist
			if (self.clients.openWindow) {
				return self.clients.openWindow(safeUrl);
			}
		})
	);
});

// Log activation
self.addEventListener('activate', (event) => {
	console.log('Service worker activated');
	event.waitUntil(self.clients.claim());
});

// Listen for sync events
self.addEventListener('sync', (event) => {
	console.log('[SW] Sync event received:', event.tag);
	// Background sync events are handled by the BackgroundSyncPlugin
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
	if (event.data && event.data.type === 'CLEAR_AUTH_CACHE') {
		event.waitUntil(caches.delete('supabase-data'));
	}
});
