import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { Profile } from '$lib/database.types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session, user } = await safeGetSession();

	if (!session || !user) {
		redirect(303, '/login');
	}

	// Check if user is a courier
	const { data } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	const profile = data as Profile | null;

	if (!profile || profile.role !== 'courier') {
		redirect(303, '/client');
	}

	return {
		profile: { role: profile.role, name: profile.name }
	};
};
