import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server.js';

// Paraglide handle - MUST be first to set locale context
const i18nHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', 'ltr')
		});
	});

// Supabase handle
const supabaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					// Set 400-day default only if Supabase didn't specify maxAge
					// This preserves maxAge: 0 for logout (cookie deletion)
					// and respects any explicit maxAge from token rotation
					const maxAge =
						options.maxAge === undefined
							? 60 * 60 * 24 * 400 // 400 days default
							: options.maxAge; // Respect Supabase's value (including 0)

					event.cookies.set(name, value, { ...options, path: '/', maxAge });
				});
			}
		}
	});

	/**
	 * Unlike `supabase.auth.getSession`, which is unsafe on the server because it
	 * doesn't validate the JWT, this function validates the JWT by first calling
	 * `getUser` and aborts early if the JWT signature is invalid.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			return { session: null, user: null };
		}

		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name: string) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

// Combine handles - i18n FIRST, then supabase
export const handle = sequence(i18nHandle, supabaseHandle);
