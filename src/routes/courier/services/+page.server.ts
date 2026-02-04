import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { notifyClient } from '$lib/services/notifications.js';
import { formatDateTimePtPT } from '$lib/utils/date-format.js';

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

		const deliveredAt = status === 'delivered' ? new Date().toISOString() : null;
		const updateData: Record<string, unknown> = {
			status,
			updated_at: new Date().toISOString()
		};
		if (status === 'delivered') {
			updateData.delivered_at = deliveredAt;
		}

		// Get service details for notifications before update (only for delivered status)
		let servicesToNotify: Array<{
			id: string;
			client_id: string;
			pickup_location: string;
			delivery_location: string;
		}> = [];
		if (status === 'delivered') {
			const { data: servicesData } = await supabase
				.from('services')
				.select('id, client_id, pickup_location, delivery_location')
				.in('id', serviceIds);
			servicesToNotify = (servicesData || []) as typeof servicesToNotify;
		}

		const { error: updateError } = await supabase
			.from('services')
			.update(updateData)
			.in('id', serviceIds);

		if (updateError) {
			console.error('Failed to update batch service status:', updateError);
			return fail(500, { error: 'Failed to update service status' });
		}

		// Notify clients when marked as delivered
		if (status === 'delivered' && servicesToNotify.length > 0) {
			const formattedDeliveredAt = formatDateTimePtPT(new Date());

			// Send notifications in parallel
			await Promise.all(
				servicesToNotify.map((service) =>
					notifyClient({
						session,
						clientId: service.client_id,
						serviceId: service.id,
						category: 'service_status',
						title: 'Serviço Entregue',
						message: 'O seu serviço foi marcado como entregue.',
						emailTemplate: 'delivered',
						emailData: {
							pickup_location: service.pickup_location,
							delivery_location: service.delivery_location,
							delivered_at: formattedDeliveredAt
						}
					})
				)
			);
		}

		return { success: true };
	}
};
