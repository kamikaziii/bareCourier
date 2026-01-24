/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
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
		while ((entry = await queue.shiftRequest())) {
			try {
				const response = await fetch(entry.request.clone());
				if (!response.ok) {
					// Re-queue if the request failed
					await queue.unshiftRequest(entry);
					throw new Error(`Request failed with status ${response.status}`);
				}
				console.log('[SW] Synced:', entry.request.url);
				// Notify clients of successful sync
				notifyClients({ type: 'SYNC_COMPLETE', url: entry.request.url });
			} catch (error) {
				console.error('[SW] Sync failed, re-queuing:', error);
				await queue.unshiftRequest(entry);
				throw error; // Re-throw to trigger retry
			}
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
			}),
			new CacheableResponsePlugin({
				statuses: [0, 200]
			})
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
			}),
			new CacheableResponsePlugin({
				statuses: [0, 200]
			})
		]
	})
);

// Push notification handling
self.addEventListener('push', (event) => {
	if (!event.data) return;

	const data = event.data.json();

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

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// Try to focus an existing window
			for (const client of clientList) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					client.navigate(url);
					return client.focus();
				}
			}
			// Open new window if none exist
			if (self.clients.openWindow) {
				return self.clients.openWindow(url);
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
	// Handle sync status request
	if (event.data && event.data.type === 'GET_SYNC_STATUS') {
		// This would be used to get pending sync count
		// The actual pending count is managed by workbox-background-sync
		event.ports?.[0]?.postMessage({ pending: 0 });
	}
});
