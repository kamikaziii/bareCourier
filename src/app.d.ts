// See https://svelte.dev/docs/kit/types#app.d.ts
/// <reference types="vite-plugin-pwa/svelte" />
/// <reference types="vite-plugin-pwa/info" />

import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database, LayoutProfile } from '$lib/database.types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			session: Session | null;
			supabase?: SupabaseClient<Database>;
			// Profile subset returned by layout servers (discriminated by role)
			profile?: LayoutProfile;
			// Navigation badge counts
			navCounts?: {
				// Courier: pending requests + pending reschedules
				pendingRequests?: number;
				// Client: services suggested by courier awaiting response
				suggestedServices?: number;
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

// Declare environment variables for TypeScript
declare module '$env/static/public' {
	export const PUBLIC_SUPABASE_URL: string;
	export const PUBLIC_SUPABASE_ANON_KEY: string;
	export const PUBLIC_MAPBOX_TOKEN: string;
	export const PUBLIC_OPENROUTESERVICE_KEY: string;
	export const PUBLIC_VAPID_PUBLIC_KEY: string;
}

// Workbox types for service worker
declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

export {};
