import type { Actions, RequestEvent } from './$types';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { notifyCourier } from '$lib/services/notifications.js';
import { formatDatePtPT } from '$lib/utils/date-format.js';
import { APP_URL } from '$lib/constants.js';

// ============================================================================
// Types for batch operation factory
// ============================================================================

type BatchSuggestionConfig = {
	action: 'accept' | 'decline';
	rpcFunction: 'client_approve_reschedule' | 'client_deny_reschedule';
	/** Fields to select from services table (beyond common fields) */
	extraSelectFields: string;
	notification: {
		title: string;
		template: 'suggestion_accepted' | 'suggestion_declined';
		message: (count: number) => string;
		partialMessage: (succeeded: number, total: number) => string;
	};
	/** Build email data from service data */
	buildEmailData: (service: BatchServiceData) => Record<string, string>;
};

type BatchServiceData = {
	id: string;
	client_id: string;
	pickup_location: string;
	delivery_location: string;
	profiles: { name: string };
	suggested_date?: string | null;
	scheduled_date?: string | null;
};

const MAX_BATCH_SIZE = 50;

// ============================================================================
// Batch operation factory
// ============================================================================

function createBatchSuggestionHandler(config: BatchSuggestionConfig) {
	return async ({ request, locals: { supabase, safeGetSession } }: RequestEvent) => {
		// 1. Auth check
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// 2. Parse service IDs from form data
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

		// 3. Batch size validation
		if (serviceIds.length > MAX_BATCH_SIZE) {
			return {
				success: false,
				error: `Maximum ${MAX_BATCH_SIZE} services per batch. Please select fewer services.`
			};
		}

		// 4. Verify ownership and fetch service data for email
		const baseFields = 'id, client_id, pickup_location, delivery_location, profiles!client_id(name)';
		const selectFields = config.extraSelectFields
			? `${baseFields}, ${config.extraSelectFields}`
			: baseFields;

		const { data: rawServicesData } = await supabase
			.from('services')
			.select(selectFields)
			.in('id', serviceIds)
			.eq('client_id', user.id);

		const servicesData = rawServicesData as BatchServiceData[] | null;

		if (!servicesData || servicesData.length !== serviceIds.length) {
			return { success: false, error: 'Some services not found or unauthorized' };
		}

		// 5. Execute RPC for each service (includes history tracking)
		const rpcPromises = servicesData.map((svc) =>
			supabase
				.rpc(config.rpcFunction, { p_service_id: svc.id })
				.then((result) => ({ id: svc.id, ...result }))
		);

		const results = await Promise.all(rpcPromises);
		const failedResults = results.filter(
			(r) => r.error || !(r.data as { success: boolean } | null)?.success
		);
		const successCount = results.length - failedResults.length;

		// 6. Prepare notification data
		const clientName = servicesData[0]?.profiles?.name || 'Cliente';
		const firstService = servicesData[0];
		const emailData = config.buildEmailData(firstService);

		// 7. Handle results and send notification
		if (failedResults.length > 0) {
			if (successCount > 0) {
				// Partial success - still notify for successful ones
				await sendBatchNotification({
					supabase,
					session,
					serviceId: firstService.id,
					title: config.notification.title,
					message: config.notification.partialMessage(successCount, servicesData.length),
					emailTemplate: config.notification.template,
					emailData: { ...emailData, client_name: clientName, app_url: APP_URL }
				});
			}
			return {
				success: false,
				partial: successCount > 0,
				succeeded: successCount,
				failed: failedResults.length,
				failedIds: failedResults.map((r) => r.id),
				error: `${failedResults.length} of ${serviceIds.length} operations failed`
			};
		}

		// Full success
		await sendBatchNotification({
			supabase,
			session,
			serviceId: firstService.id,
			title: config.notification.title,
			message: config.notification.message(servicesData.length),
			emailTemplate: config.notification.template,
			emailData: { ...emailData, client_name: clientName, app_url: APP_URL }
		});

		return { success: true };
	};
}

async function sendBatchNotification(params: {
	supabase: SupabaseClient;
	session: Session;
	serviceId: string;
	title: string;
	message: string;
	emailTemplate: string;
	emailData: Record<string, string>;
}) {
	try {
		await notifyCourier({
			supabase: params.supabase,
			session: params.session,
			serviceId: params.serviceId,
			category: 'schedule_change',
			title: params.title,
			message: params.message,
			emailTemplate: params.emailTemplate,
			emailData: params.emailData
		});
	} catch (error) {
		console.error(`Notification failed for batch operation (${params.emailTemplate})`, error);
	}
}

// ============================================================================
// Batch handler configurations
// ============================================================================

const batchAcceptConfig: BatchSuggestionConfig = {
	action: 'accept',
	rpcFunction: 'client_approve_reschedule',
	extraSelectFields: 'suggested_date',
	notification: {
		title: 'Sugestões Aceites',
		template: 'suggestion_accepted',
		message: (n) => `O cliente aceitou ${n} sugestão(ões) de data.`,
		partialMessage: (succeeded, total) =>
			`O cliente aceitou ${succeeded} de ${total} sugestão(ões) de data.`
	},
	buildEmailData: (service) => ({
		pickup_location: service.pickup_location,
		delivery_location: service.delivery_location,
		new_date: formatDatePtPT(service.suggested_date ?? null),
		service_id: service.id
	})
};

const batchDeclineConfig: BatchSuggestionConfig = {
	action: 'decline',
	rpcFunction: 'client_deny_reschedule',
	extraSelectFields: 'scheduled_date',
	notification: {
		title: 'Sugestões Recusadas',
		template: 'suggestion_declined',
		message: (n) => `O cliente recusou ${n} sugestão(ões). Os pedidos estão novamente pendentes.`,
		partialMessage: (succeeded, total) =>
			`O cliente recusou ${succeeded} de ${total} sugestão(ões). Os pedidos estão novamente pendentes.`
	},
	buildEmailData: (service) => ({
		pickup_location: service.pickup_location,
		delivery_location: service.delivery_location,
		original_date: formatDatePtPT(service.scheduled_date ?? null, 'Não agendada'),
		reason: '',
		service_id: service.id
	})
};

// ============================================================================
// Actions export
// ============================================================================

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
		try {
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
		} catch (error) {
			console.error('Notification failed for service', serviceId, error);
		}

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
		try {
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
		} catch (error) {
			console.error('Notification failed for service', serviceId, error);
		}

		return { success: true };
	},

	batchAcceptSuggestions: createBatchSuggestionHandler(batchAcceptConfig),

	batchDeclineSuggestions: createBatchSuggestionHandler(batchDeclineConfig),

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
		try {
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
		} catch (error) {
			console.error('Notification failed for service', serviceId, error);
		}

		return { success: true };
	}
};
