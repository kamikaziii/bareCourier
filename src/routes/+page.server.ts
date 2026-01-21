import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Profile } from '$lib/database.types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session, user } = await safeGetSession();

	// If not logged in, redirect to login
	if (!session || !user) {
		redirect(303, '/login');
	}

	// Get user profile to determine role
	const { data } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.single();

	const profile = data as Pick<Profile, 'role'> | null;

	// Redirect based on role
	if (profile?.role === 'courier') {
		redirect(303, '/courier');
	} else if (profile?.role === 'client') {
		redirect(303, '/client');
	}

	// If no profile, redirect to login (something went wrong)
	redirect(303, '/login');
};
