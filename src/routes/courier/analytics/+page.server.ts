import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Profile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load all clients for filters
	const { data: clients } = await supabase
		.from('profiles')
		.select('id, name')
		.eq('role', 'client')
		.order('name');

	return {
		clients: (clients || []) as Pick<Profile, 'id' | 'name'>[]
	};
};
