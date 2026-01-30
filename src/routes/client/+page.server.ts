import type { Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { notifyCourier } from '$lib/services/notifications';

export const actions: Actions = {
	acceptSuggestion: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get the service and verify ownership
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, suggested_date, suggested_time_slot, suggested_time')
			.eq('id', serviceId)
			.single();

		if (!serviceData) {
			return { success: false, error: 'Service not found' };
		}

		const service = serviceData as {
			client_id: string;
			suggested_date: string | null;
			suggested_time_slot: string | null;
			suggested_time: string | null;
		};

		if (service.client_id !== user.id) {
			return { success: false, error: 'Unauthorized' };
		}

		// Accept the suggestion - copy suggested to scheduled and mark as accepted
		const { error: updateError } = await supabase
			.from('services')
			.update({
				request_status: 'accepted',
				scheduled_date: service.suggested_date,
				scheduled_time_slot: service.suggested_time_slot,
				scheduled_time: service.suggested_time,
				suggested_date: null,
				suggested_time_slot: null,
				suggested_time: null
			})
			.eq('id', serviceId);

		if (updateError) {
			console.error('Failed to accept suggestion:', updateError);
			return { success: false, error: 'Failed to accept suggestion' };
		}

		// Notify courier (no email template needed for this direction)
		await notifyCourier({
			supabase,
			session,
			serviceId,
			category: 'schedule_change',
			title: 'Sugestão Aceite',
			message: 'O cliente aceitou a data sugerida para o serviço.'
		});

		return { success: true };
	},

	declineSuggestion: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get the service and verify ownership
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id')
			.eq('id', serviceId)
			.single();

		if (!serviceData) {
			return { success: false, error: 'Service not found' };
		}

		const service = serviceData as { client_id: string };

		if (service.client_id !== user.id) {
			return { success: false, error: 'Unauthorized' };
		}

		// Decline the suggestion - set back to pending for courier to review
		const { error: updateError } = await supabase
			.from('services')
			.update({
				request_status: 'pending',
				suggested_date: null,
				suggested_time_slot: null,
				suggested_time: null
			})
			.eq('id', serviceId);

		if (updateError) {
			console.error('Failed to decline suggestion:', updateError);
			return { success: false, error: 'Failed to decline suggestion' };
		}

		// Notify courier (no email template needed for this direction)
		await notifyCourier({
			supabase,
			session,
			serviceId,
			category: 'schedule_change',
			title: 'Sugestão Recusada',
			message: 'O cliente recusou a data sugerida. O pedido está novamente pendente.'
		});

		return { success: true };
	},

	batchAcceptSuggestions: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const serviceIdsJson = formData.get('service_ids') as string;
		if (!serviceIdsJson) {
			return { success: false, error: 'Service IDs required' };
		}

		let serviceIds: string[];
		try {
			serviceIds = JSON.parse(serviceIdsJson);
		} catch {
			return { success: false, error: 'Invalid service IDs' };
		}

		if (serviceIds.length === 0) {
			return { success: false, error: 'No services selected' };
		}

		// Get all services and verify ownership
		const { data: rawServicesData } = await supabase
			.from('services')
			.select('id, client_id, suggested_date, suggested_time_slot, suggested_time')
			.in('id', serviceIds)
			.eq('client_id', user.id);

		const servicesData = rawServicesData as {
			id: string;
			client_id: string;
			suggested_date: string | null;
			suggested_time_slot: string | null;
			suggested_time: string | null;
		}[] | null;

		if (!servicesData || servicesData.length !== serviceIds.length) {
			return { success: false, error: 'Some services not found or unauthorized' };
		}

		// Accept all suggestions in parallel
		const updatePromises = servicesData.map(svc =>
			supabase
				.from('services')
				.update({
					request_status: 'accepted',
					scheduled_date: svc.suggested_date,
					scheduled_time_slot: svc.suggested_time_slot,
					scheduled_time: svc.suggested_time,
					suggested_date: null,
					suggested_time_slot: null,
					suggested_time: null
				})
				.eq('id', svc.id)
		);

		const results = await Promise.all(updatePromises);
		const failCount = results.filter(r => r.error).length;

		if (failCount > 0) {
			if (failCount < servicesData.length) {
				// Partial success — still notify
				await notifyCourier({
					supabase,
					session,
					serviceId: servicesData[0].id,
					category: 'schedule_change',
					title: 'Sugestões Aceites',
					message: `O cliente aceitou ${servicesData.length - failCount} de ${servicesData.length} sugestão(ões) de data.`
				});
			}
			return { success: true, error: `${failCount} of ${serviceIds.length} failed` };
		}

		await notifyCourier({
			supabase,
			session,
			serviceId: servicesData[0].id,
			category: 'schedule_change',
			title: 'Sugestões Aceites',
			message: `O cliente aceitou ${servicesData.length} sugestão(ões) de data.`
		});
		return { success: true };
	},

	batchDeclineSuggestions: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const serviceIdsJson = formData.get('service_ids') as string;
		if (!serviceIdsJson) {
			return { success: false, error: 'Service IDs required' };
		}

		let serviceIds: string[];
		try {
			serviceIds = JSON.parse(serviceIdsJson);
		} catch {
			return { success: false, error: 'Invalid service IDs' };
		}

		if (serviceIds.length === 0) {
			return { success: false, error: 'No services selected' };
		}

		// Verify ownership
		const { data: rawServicesData } = await supabase
			.from('services')
			.select('id, client_id')
			.in('id', serviceIds)
			.eq('client_id', user.id);

		const servicesData = rawServicesData as { id: string; client_id: string }[] | null;

		if (!servicesData || servicesData.length !== serviceIds.length) {
			return { success: false, error: 'Some services not found or unauthorized' };
		}

		// Decline all suggestions in parallel
		const updatePromises = servicesData.map(svc =>
			supabase
				.from('services')
				.update({
					request_status: 'pending',
					suggested_date: null,
					suggested_time_slot: null,
					suggested_time: null
				})
				.eq('id', svc.id)
		);

		const results = await Promise.all(updatePromises);
		const failCount = results.filter(r => r.error).length;

		if (failCount > 0) {
			if (failCount < servicesData.length) {
				await notifyCourier({
					supabase,
					session,
					serviceId: servicesData[0].id,
					category: 'schedule_change',
					title: 'Sugestões Recusadas',
					message: `O cliente recusou ${servicesData.length - failCount} de ${servicesData.length} sugestão(ões). Os pedidos estão novamente pendentes.`
				});
			}
			return { success: true, error: `${failCount} of ${serviceIds.length} failed` };
		}

		await notifyCourier({
			supabase,
			session,
			serviceId: servicesData[0].id,
			category: 'schedule_change',
			title: 'Sugestões Recusadas',
			message: `O cliente recusou ${servicesData.length} sugestão(ões). Os pedidos estão novamente pendentes.`
		});
		return { success: true };
	},

	cancelRequest: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get the service and verify ownership + status + data for email
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, request_status, pickup_location, delivery_location, profiles!client_id(name)')
			.eq('id', serviceId)
			.single();

		if (!serviceData) {
			return { success: false, error: 'Service not found' };
		}

		const service = serviceData as {
			client_id: string;
			request_status: string;
			pickup_location: string;
			delivery_location: string;
			profiles: { name: string };
		};

		if (service.client_id !== user.id) {
			return { success: false, error: 'Unauthorized' };
		}

		// Only allow cancellation of pending requests
		if (service.request_status !== 'pending') {
			return { success: false, error: 'Only pending requests can be cancelled' };
		}

		// Soft delete by setting deleted_at
		const { error: updateError } = await supabase
			.from('services')
			.update({
				deleted_at: new Date().toISOString()
			})
			.eq('id', serviceId);

		if (updateError) {
			console.error('Failed to cancel request:', updateError);
			return { success: false, error: 'Failed to cancel request' };
		}

		// Notify courier with email
		await notifyCourier({
			supabase,
			session,
			serviceId,
			category: 'new_request',
			title: 'Pedido Cancelado',
			message: 'O cliente cancelou um pedido de serviço pendente.',
			emailTemplate: 'request_cancelled',
			emailData: {
				client_name: service.profiles.name,
				pickup_location: service.pickup_location,
				delivery_location: service.delivery_location,
				app_url: PUBLIC_SUPABASE_URL.replace('/functions/v1', '')
			}
		});

		return { success: true };
	}
};
