import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, Service } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load client profile
	const { data: client, error: clientError } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', params.id)
		.eq('role', 'client')
		.single();

	if (clientError || !client) {
		error(404, 'Client not found');
	}

	// Load client's services
	const { data: services } = await supabase
		.from('services')
		.select('*')
		.eq('client_id', params.id)
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	// Calculate statistics
	const allServices = (services || []) as Service[];
	const pendingCount = allServices.filter((s) => s.status === 'pending').length;
	const deliveredCount = allServices.filter((s) => s.status === 'delivered').length;

	return {
		client: client as Profile,
		services: allServices,
		stats: {
			total: allServices.length,
			pending: pendingCount,
			delivered: deliveredCount
		}
	};
};

export const actions: Actions = {
	toggleActive: async ({ params, locals: { supabase, safeGetSession } }) => {
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

		// Get current status
		const { data: client } = await supabase
			.from('profiles')
			.select('active')
			.eq('id', params.id)
			.single();

		if (!client) {
			return { success: false, error: 'Client not found' };
		}

		const clientData = client as { active: boolean };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('profiles')
			.update({ active: !clientData.active })
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		return { success: true };
	}
};
