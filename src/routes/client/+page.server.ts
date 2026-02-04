import type { Actions } from './$types';
import { notifyCourier } from '$lib/services/notifications.js';
import { formatDatePtPT } from '$lib/utils/date-format.js';

const APP_URL = 'https://barecourier.vercel.app';

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

		// Get the service and verify ownership (include fields for email)
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, suggested_date, suggested_time_slot, suggested_time, pickup_location, delivery_location, profiles!client_id(name)')
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
			pickup_location: string;
			delivery_location: string;
			profiles: { name: string };
		};

		if (service.client_id !== user.id) {
			return { success: false, error: 'Unauthorized' };
		}

		// Use RPC function to accept the suggestion (includes history tracking)
		const { data: rpcResult, error: rpcError } = await supabase.rpc('client_approve_reschedule', {
			p_service_id: serviceId
		});

		if (rpcError) {
			console.error('Failed to accept suggestion:', rpcError);
			return { success: false, error: 'Failed to accept suggestion' };
		}

		const result = rpcResult as { success: boolean; error?: string } | null;
		if (!result?.success) {
			return { success: false, error: result?.error || 'Failed to accept suggestion' };
		}

		// Format the new date for email
		const formattedNewDate = formatDatePtPT(service.suggested_date);

		// Notify courier with email
		await notifyCourier({
			supabase,
			session,
			serviceId,
			category: 'schedule_change',
			title: 'Sugestão Aceite',
			message: 'O cliente aceitou a data sugerida para o serviço.',
			emailTemplate: 'suggestion_accepted',
			emailData: {
				client_name: service.profiles?.name || 'Cliente',
				pickup_location: service.pickup_location,
				delivery_location: service.delivery_location,
				new_date: formattedNewDate,
				service_id: serviceId,
				app_url: APP_URL
			}
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

		// Get the service and verify ownership (include fields for email)
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, scheduled_date, pickup_location, delivery_location, profiles!client_id(name)')
			.eq('id', serviceId)
			.single();

		if (!serviceData) {
			return { success: false, error: 'Service not found' };
		}

		const service = serviceData as {
			client_id: string;
			scheduled_date: string | null;
			pickup_location: string;
			delivery_location: string;
			profiles: { name: string };
		};

		if (service.client_id !== user.id) {
			return { success: false, error: 'Unauthorized' };
		}

		// Use RPC function to decline the suggestion (includes history tracking)
		const { data: rpcResult, error: rpcError } = await supabase.rpc('client_deny_reschedule', {
			p_service_id: serviceId
		});

		if (rpcError) {
			console.error('Failed to decline suggestion:', rpcError);
			return { success: false, error: 'Failed to decline suggestion' };
		}

		const result = rpcResult as { success: boolean; error?: string } | null;
		if (!result?.success) {
			return { success: false, error: result?.error || 'Failed to decline suggestion' };
		}

		// Format the original date for email
		const formattedOriginalDate = formatDatePtPT(service.scheduled_date, 'Não agendada');

		// Notify courier with email
		await notifyCourier({
			supabase,
			session,
			serviceId,
			category: 'schedule_change',
			title: 'Sugestão Recusada',
			message: 'O cliente recusou a data sugerida. O pedido está novamente pendente.',
			emailTemplate: 'suggestion_declined',
			emailData: {
				client_name: service.profiles?.name || 'Cliente',
				pickup_location: service.pickup_location,
				delivery_location: service.delivery_location,
				original_date: formattedOriginalDate,
				reason: '',
				service_id: serviceId,
				app_url: APP_URL
			}
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

		const MAX_BATCH_SIZE = 50;

		if (serviceIds.length > MAX_BATCH_SIZE) {
			return {
				success: false,
				error: `Maximum ${MAX_BATCH_SIZE} services per batch. Please select fewer services.`
			};
		}

		// Get all services and verify ownership (include fields for email)
		const { data: rawServicesData } = await supabase
			.from('services')
			.select('id, client_id, suggested_date, suggested_time_slot, suggested_time, pickup_location, delivery_location, profiles!client_id(name)')
			.in('id', serviceIds)
			.eq('client_id', user.id);

		const servicesData = rawServicesData as {
			id: string;
			client_id: string;
			suggested_date: string | null;
			suggested_time_slot: string | null;
			suggested_time: string | null;
			pickup_location: string;
			delivery_location: string;
			profiles: { name: string };
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

		// Get client name for email
		const clientName = servicesData[0]?.profiles?.name || 'Cliente';
		const firstService = servicesData[0];

		if (failCount > 0) {
			if (failCount < servicesData.length) {
				// Partial success — still notify
				const formattedNewDate = formatDatePtPT(firstService.suggested_date);

				await notifyCourier({
					supabase,
					session,
					serviceId: servicesData[0].id,
					category: 'schedule_change',
					title: 'Sugestões Aceites',
					message: `O cliente aceitou ${servicesData.length - failCount} de ${servicesData.length} sugestão(ões) de data.`,
					emailTemplate: 'suggestion_accepted',
					emailData: {
						client_name: clientName,
						pickup_location: firstService.pickup_location,
						delivery_location: firstService.delivery_location,
						new_date: formattedNewDate,
						service_id: firstService.id,
						app_url: APP_URL
					}
				});
			}
			return { success: true, error: `${failCount} of ${serviceIds.length} failed` };
		}

		const formattedNewDate = formatDatePtPT(firstService.suggested_date);

		await notifyCourier({
			supabase,
			session,
			serviceId: servicesData[0].id,
			category: 'schedule_change',
			title: 'Sugestões Aceites',
			message: `O cliente aceitou ${servicesData.length} sugestão(ões) de data.`,
			emailTemplate: 'suggestion_accepted',
			emailData: {
				client_name: clientName,
				pickup_location: firstService.pickup_location,
				delivery_location: firstService.delivery_location,
				new_date: formattedNewDate,
				service_id: firstService.id,
				app_url: APP_URL
			}
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

		const MAX_BATCH_SIZE = 50;

		if (serviceIds.length > MAX_BATCH_SIZE) {
			return {
				success: false,
				error: `Maximum ${MAX_BATCH_SIZE} services per batch. Please select fewer services.`
			};
		}

		// Verify ownership (include fields for email)
		const { data: rawServicesData } = await supabase
			.from('services')
			.select('id, client_id, scheduled_date, pickup_location, delivery_location, profiles!client_id(name)')
			.in('id', serviceIds)
			.eq('client_id', user.id);

		const servicesData = rawServicesData as {
			id: string;
			client_id: string;
			scheduled_date: string | null;
			pickup_location: string;
			delivery_location: string;
			profiles: { name: string };
		}[] | null;

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

		// Get client name and format date for email
		const clientName = servicesData[0]?.profiles?.name || 'Cliente';
		const firstService = servicesData[0];
		const formattedOriginalDate = formatDatePtPT(firstService.scheduled_date, 'Não agendada');

		if (failCount > 0) {
			if (failCount < servicesData.length) {
				await notifyCourier({
					supabase,
					session,
					serviceId: servicesData[0].id,
					category: 'schedule_change',
					title: 'Sugestões Recusadas',
					message: `O cliente recusou ${servicesData.length - failCount} de ${servicesData.length} sugestão(ões). Os pedidos estão novamente pendentes.`,
					emailTemplate: 'suggestion_declined',
					emailData: {
						client_name: clientName,
						pickup_location: firstService.pickup_location,
						delivery_location: firstService.delivery_location,
						original_date: formattedOriginalDate,
						reason: '',
						service_id: firstService.id,
						app_url: APP_URL
					}
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
			message: `O cliente recusou ${servicesData.length} sugestão(ões). Os pedidos estão novamente pendentes.`,
			emailTemplate: 'suggestion_declined',
			emailData: {
				client_name: clientName,
				pickup_location: firstService.pickup_location,
				delivery_location: firstService.delivery_location,
				original_date: formattedOriginalDate,
				reason: '',
				service_id: firstService.id,
				app_url: APP_URL
			}
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
				app_url: APP_URL
			}
		});

		return { success: true };
	}
};
