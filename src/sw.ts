/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

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

// Handle service worker messages
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

// Log activation
self.addEventListener('activate', (event) => {
	console.log('Service worker activated');
	event.waitUntil(self.clients.claim());
});
