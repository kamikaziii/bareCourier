import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { session, supabase } = await parent();

	// If already logged in, redirect to home
	if (session) {
		redirect(303, '/');
	}

	return { supabase };
};
