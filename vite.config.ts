import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['url', 'cookie', 'baseLocale'],
			urlPatterns: [
				{
					pattern: '/:path(.*)?',
					localized: [
						['pt-PT', '/:path(.*)?'],
						['en', '/en/:path(.*)?']
					]
				}
			]
		}),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'prompt',
			manifest: false,
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				globIgnores: ['**/apple-splash-*.png'],
				runtimeCaching: [
					{
						// Supabase Auth - NetworkOnly (never cache)
						urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
						handler: 'NetworkOnly',
						options: {
							cacheName: 'supabase-auth'
						}
					},
					{
						// Supabase REST API - NetworkFirst with cache fallback
						urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'supabase-data',
							networkTimeoutSeconds: 10,
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 // 24 hours
							},
							cacheableResponse: {
								statuses: [0, 200]
							}
						}
					}
				],
				skipWaiting: false,
				clientsClaim: true
			},
			devOptions: {
				enabled: true,
				type: 'module'
			}
		})
	]
});
