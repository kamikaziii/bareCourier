import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Service, ServiceStatusHistory } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load service - RLS will ensure client can only see their own services
	const { data: service, error: serviceError } = await supabase
		.from('services')
		.select('*')
		.eq('id', params.id)
		.single();

	if (serviceError || !service) {
		error(404, 'Service not found');
	}

	// Verify this service belongs to the current user
	if ((service as { client_id: string }).client_id !== user.id) {
		error(403, 'Access denied');
	}

	// Load status history
	const { data: statusHistory } = await supabase
		.from('service_status_history')
		.select('*')
		.eq('service_id', params.id)
		.order('changed_at', { ascending: false });

	return {
		service: service as Service,
		statusHistory: (statusHistory || []) as ServiceStatusHistory[]
	};
};
