import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { Profile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, depends }) => {
	const { session, user } = await safeGetSession();

	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Declare dependency for manual invalidation of nav counts
	depends('app:nav-counts');

	// Get user profile
	const { data } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	const profile = data as Profile | null;

	// If no profile exists, sign out and redirect to login
	if (!profile) {
		await supabase.auth.signOut();
		redirect(303, localizeHref('/login'));
	}

	// If user is courier, redirect to courier dashboard
	if (profile.role === 'courier') {
		redirect(303, localizeHref('/courier'));
	}

	// If client is not active, sign out and redirect to login
	if (!profile.active) {
		await supabase.auth.signOut();
		redirect(303, localizeHref('/login'));
	}

	// Fetch count of services awaiting client response (suggested by courier)
	const { count: suggestedCount } = await supabase
		.from('services')
		.select('*', { count: 'exact', head: true })
		.eq('client_id', user.id)
		.eq('request_status', 'suggested')
		.is('deleted_at', null);

	return {
		profile: {
			id: profile.id,
			role: profile.role,
			name: profile.name,
			default_pickup_location: profile.default_pickup_location
		},
		navCounts: {
			suggestedServices: suggestedCount ?? 0
		}
	};
};
