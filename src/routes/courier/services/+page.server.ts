import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	if (!user) {
		return { services: [], clients: [] };
	}

	// Fetch services and clients in parallel
	const [servicesResult, clientsResult] = await Promise.all([
		supabase
			.from('services')
			.select('*, profiles!client_id(id, name, default_pickup_location)')
			.is('deleted_at', null)
			.order('created_at', { ascending: false }),
		supabase
			.from('profiles')
			.select('id, name, default_pickup_location')
			.eq('role', 'client')
			.eq('active', true)
			.order('name')
	]);

	return {
		services: servicesResult.data || [],
		clients: clientsResult.data || []
	};
};

export const actions: Actions = {
	batchStatusChange: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if ((profile as { role: string } | null)?.role !== 'courier') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		let serviceIds: string[];
		try {
			serviceIds = JSON.parse(formData.get('service_ids') as string);
		} catch {
			return fail(400, { error: 'Invalid service selection' });
		}

		const status = formData.get('status') as string;
		if (!serviceIds?.length || !['pending', 'delivered'].includes(status)) {
			return fail(400, { error: 'Invalid request' });
		}

		const updateData: Record<string, unknown> = {
			status,
			updated_at: new Date().toISOString()
		};
		if (status === 'delivered') {
			updateData.delivered_at = new Date().toISOString();
		}

		const { error: updateError } = await supabase
			.from('services')
			.update(updateData)
			.in('id', serviceIds);

		if (updateError) {
			console.error('Failed to update batch service status:', updateError);
			return fail(500, { error: 'Failed to update service status' });
		}

		return { success: true };
	}
};
