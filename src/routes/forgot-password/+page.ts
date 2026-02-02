import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageLoad = async ({ parent }) => {
	const { session, supabase } = await parent();

	// If already logged in, redirect to home
	if (session) {
		redirect(303, localizeHref('/'));
	}

	return { supabase };
};
