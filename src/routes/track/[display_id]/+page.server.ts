import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, url, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	// User must be logged in - pass current URL as redirect destination
	if (!session || !user) {
		const redirectTo = encodeURIComponent(url.pathname);
		redirect(303, localizeHref(`/login?redirectTo=${redirectTo}`));
	}

	// Handle display_id with or without the # prefix
	const displayId = params.display_id.startsWith('#')
		? params.display_id
		: `#${params.display_id}`;

	// Look up service by display_id
	const { data: service } = await supabase
		.from('services')
		.select('id, client_id')
		.eq('display_id', displayId)
		.single();

	if (!service) {
		// Service not found - redirect to home based on role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const role = (profile as { role: string } | null)?.role;
		if (role === 'courier') {
			redirect(303, localizeHref('/courier'));
		} else {
			redirect(303, localizeHref('/client'));
		}
	}

	// Get user's role to determine redirect destination
	const { data: profile } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.single();

	const role = (profile as { role: string } | null)?.role;

	if (role === 'courier') {
		// Courier can view any service
		redirect(303, localizeHref(`/courier/services/${service.id}`));
	} else if (role === 'client') {
		// Client can only view their own services
		if (service.client_id === user.id) {
			redirect(303, localizeHref(`/client/services/${service.id}`));
		} else {
			// Not their service - redirect to client home
			redirect(303, localizeHref('/client'));
		}
	}

	// Fallback - shouldn't happen
	redirect(303, localizeHref('/'));
};
