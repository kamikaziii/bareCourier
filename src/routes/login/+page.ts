import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageLoad = async ({ parent, url }) => {
	const { session, supabase } = await parent();

	// Get redirect destination from query param (if any)
	const redirectTo = url.searchParams.get('redirectTo');

	// If already logged in, redirect to intended destination or home
	if (session) {
		redirect(303, redirectTo || localizeHref('/'));
	}

	return { supabase, redirectTo };
};
