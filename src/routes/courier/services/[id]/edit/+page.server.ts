import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, Profile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load service with client info
	const { data: service, error: serviceError } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name)')
		.eq('id', params.id)
		.single();

	if (serviceError || !service) {
		error(404, 'Service not found');
	}

	// Load all active clients for client selection
	const { data: clients } = await supabase
		.from('profiles')
		.select('id, name, default_pickup_location')
		.eq('role', 'client')
		.eq('active', true)
		.order('name');

	return {
		service: service as Service & { profiles: Pick<Profile, 'id' | 'name'> },
		clients: (clients || []) as Pick<Profile, 'id' | 'name' | 'default_pickup_location'>[]
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify user is courier
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();

		const client_id = formData.get('client_id') as string;
		const pickup_location = formData.get('pickup_location') as string;
		const delivery_location = formData.get('delivery_location') as string;
		const notes = formData.get('notes') as string;

		if (!client_id || !pickup_location || !delivery_location) {
			return { success: false, error: 'Required fields missing' };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				client_id,
				pickup_location,
				delivery_location,
				notes: notes || null
			})
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		redirect(303, localizeHref(`/courier/services/${params.id}`));
	}
};
