import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, Profile } from '$lib/database.types';
import { localizeHref, extractLocaleFromRequest } from '$lib/paraglide/runtime.js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Helper to send notification to client
async function notifyClient(
	session: { access_token: string },
	clientId: string,
	serviceId: string,
	subject: string,
	message: string
) {
	try {
		const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${session.access_token}`,
				'apikey': PUBLIC_SUPABASE_ANON_KEY
			},
			body: JSON.stringify({
				type: 'both',
				user_id: clientId,
				subject,
				message,
				service_id: serviceId,
				url: `/client/services/${serviceId}`
			})
		});

		if (!response.ok) {
			console.error('Failed to send notification:', await response.text());
		}
	} catch (error) {
		console.error('Notification error:', error);
	}
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load pending service requests (services with request_status = 'pending')
	const { data: pendingRequests } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone)')
		.eq('request_status', 'pending')
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	// Load services with pending reschedule requests
	const { data: pendingReschedules } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone)')
		.not('pending_reschedule_date', 'is', null)
		.is('deleted_at', null)
		.order('pending_reschedule_requested_at', { ascending: true });

	return {
		pendingRequests: (pendingRequests || []) as (Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> })[],
		pendingReschedules: (pendingReschedules || []) as (Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> })[]
	};
};

export const actions: Actions = {
	accept: async ({ request, locals: { supabase, safeGetSession } }) => {
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
		const serviceId = formData.get('service_id') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get the service to copy requested schedule to scheduled
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, requested_date, requested_time_slot, requested_time')
			.eq('id', serviceId)
			.single();

		if (!serviceData) {
			return { success: false, error: 'Service not found' };
		}

		const service = serviceData as {
			client_id: string;
			requested_date: string | null;
			requested_time_slot: string | null;
			requested_time: string | null;
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				request_status: 'accepted',
				scheduled_date: service.requested_date,
				scheduled_time_slot: service.requested_time_slot,
				scheduled_time: service.requested_time
			})
			.eq('id', serviceId);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		// Notify client
		await notifyClient(
			session,
			service.client_id,
			serviceId,
			'Pedido Aceite',
			'O seu pedido de serviço foi aceite pelo estafeta. Verifique os detalhes na aplicação.'
		);

		return { success: true };
	},

	reject: async ({ request, locals: { supabase, safeGetSession } }) => {
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
		const serviceId = formData.get('service_id') as string;
		const rejectionReason = formData.get('rejection_reason') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get client_id before updating
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id')
			.eq('id', serviceId)
			.single();

		const service = serviceData as { client_id: string } | null;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				request_status: 'rejected',
				rejection_reason: rejectionReason || null
			})
			.eq('id', serviceId);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		// Notify client
		if (service?.client_id) {
			const reasonText = rejectionReason ? ` Motivo: ${rejectionReason}` : '';
			await notifyClient(
				session,
				service.client_id,
				serviceId,
				'Pedido Rejeitado',
				`O seu pedido de serviço foi rejeitado.${reasonText}`
			);
		}

		return { success: true };
	},

	suggest: async ({ request, locals: { supabase, safeGetSession } }) => {
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
		const serviceId = formData.get('service_id') as string;
		const suggestedDate = formData.get('suggested_date') as string;
		const suggestedTimeSlot = formData.get('suggested_time_slot') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		if (!suggestedDate || !suggestedTimeSlot) {
			return { success: false, error: 'Suggested date and time slot required' };
		}

		// Get client_id before updating
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id')
			.eq('id', serviceId)
			.single();

		const service = serviceData as { client_id: string } | null;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				request_status: 'suggested',
				suggested_date: suggestedDate,
				suggested_time_slot: suggestedTimeSlot
			})
			.eq('id', serviceId);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		// Notify client
		if (service?.client_id) {
			// Use the current request's locale for formatting the notification
			const locale = extractLocaleFromRequest(request);
			const dateFormatted = new Date(suggestedDate).toLocaleDateString(locale);
			const slotLabels: Record<string, Record<string, string>> = {
				'pt-PT': {
					morning: 'Manhã',
					afternoon: 'Tarde',
					evening: 'Noite',
					specific: 'Hora específica'
				},
				en: {
					morning: 'Morning',
					afternoon: 'Afternoon',
					evening: 'Evening',
					specific: 'Specific time'
				}
			};
			const labels = slotLabels[locale] || slotLabels['pt-PT'];
			const slotText = labels[suggestedTimeSlot] || suggestedTimeSlot;

			// Notification messages by locale
			const messages: Record<string, { subject: string; body: string }> = {
				'pt-PT': {
					subject: 'Nova Data Sugerida',
					body: `O estafeta sugeriu uma nova data para o seu serviço: ${dateFormatted} (${slotText}). Aceda à aplicação para aceitar ou recusar.`
				},
				en: {
					subject: 'New Date Suggested',
					body: `The courier suggested a new date for your service: ${dateFormatted} (${slotText}). Check the app to accept or decline.`
				}
			};
			const msg = messages[locale] || messages['pt-PT'];

			await notifyClient(
				session,
				service.client_id,
				serviceId,
				msg.subject,
				msg.body
			);
		}

		return { success: true };
	},

	approveReschedule: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get the service with pending reschedule
		const { data: serviceData } = await supabase
			.from('services')
			.select('*')
			.eq('id', serviceId)
			.single();

		const service = serviceData as Service | null;

		if (!service || !service.pending_reschedule_date) {
			return { success: false, error: 'No pending reschedule request' };
		}

		// Apply the reschedule
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				scheduled_date: service.pending_reschedule_date,
				scheduled_time_slot: service.pending_reschedule_time_slot,
				scheduled_time: service.pending_reschedule_time,
				reschedule_count: (service.reschedule_count || 0) + 1,
				last_rescheduled_at: new Date().toISOString(),
				last_rescheduled_by: service.pending_reschedule_requested_by,
				pending_reschedule_date: null,
				pending_reschedule_time_slot: null,
				pending_reschedule_time: null,
				pending_reschedule_reason: null,
				pending_reschedule_requested_at: null,
				pending_reschedule_requested_by: null
			})
			.eq('id', serviceId);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		// Update history record
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (supabase as any)
			.from('service_reschedule_history')
			.update({
				approval_status: 'approved',
				approved_by: user.id,
				approved_at: new Date().toISOString()
			})
			.eq('service_id', serviceId)
			.eq('approval_status', 'pending');

		// Notify client
		if (service.client_id) {
			await notifyClient(
				session,
				service.client_id,
				serviceId,
				'Reagendamento Aprovado',
				'O seu pedido de reagendamento foi aprovado.'
			);
		}

		return { success: true };
	},

	denyReschedule: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;
		const denialReason = formData.get('denial_reason') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get the service
		const { data: serviceData2 } = await supabase
			.from('services')
			.select('client_id')
			.eq('id', serviceId)
			.single();

		const service = serviceData2 as Pick<Service, 'client_id'> | null;

		// Clear pending reschedule fields
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				pending_reschedule_date: null,
				pending_reschedule_time_slot: null,
				pending_reschedule_time: null,
				pending_reschedule_reason: null,
				pending_reschedule_requested_at: null,
				pending_reschedule_requested_by: null
			})
			.eq('id', serviceId);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		// Update history record
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await (supabase as any)
			.from('service_reschedule_history')
			.update({
				approval_status: 'denied',
				approved_by: user.id,
				approved_at: new Date().toISOString(),
				denial_reason: denialReason || null
			})
			.eq('service_id', serviceId)
			.eq('approval_status', 'pending');

		// Notify client
		if (service?.client_id) {
			const reasonText = denialReason ? ` Motivo: ${denialReason}` : '';
			await notifyClient(
				session,
				service.client_id,
				serviceId,
				'Reagendamento Recusado',
				`O seu pedido de reagendamento foi recusado.${reasonText}`
			);
		}

		return { success: true };
	}
};
