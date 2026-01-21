import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { Profile } from '$lib/database.types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session, user } = await safeGetSession();

	if (!session || !user) {
		redirect(303, '/login');
	}

	// Get user profile
	const { data } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	const profile = data as Profile | null;

	// If no profile exists, redirect to login (user needs to complete profile setup)
	if (!profile) {
		redirect(303, '/login');
	}

	// If user is courier, redirect to courier dashboard
	if (profile.role === 'courier') {
		redirect(303, '/courier');
	}

	// If client is not active, redirect to login
	if (!profile.active) {
		redirect(303, '/login');
	}

	return {
		profile: {
			role: profile.role,
			name: profile.name,
			default_pickup_location: profile.default_pickup_location
		}
	};
};
