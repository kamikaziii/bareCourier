import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Profile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session, user } = await safeGetSession();

	// If not logged in, redirect to login
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Get user profile to determine role
	const { data, error } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.single();

	const profile = data as Pick<Profile, 'role'> | null;

	// If no profile or error querying, sign out and redirect to login
	// This prevents redirect loops when profile is missing/corrupted
	if (error || !profile) {
		await supabase.auth.signOut();
		redirect(303, localizeHref('/login'));
	}

	// Redirect based on role
	if (profile.role === 'courier') {
		redirect(303, localizeHref('/courier'));
	} else if (profile.role === 'client') {
		redirect(303, localizeHref('/client'));
	}

	// Unknown role - sign out and redirect to login
	await supabase.auth.signOut();
	redirect(303, localizeHref('/login'));
};
