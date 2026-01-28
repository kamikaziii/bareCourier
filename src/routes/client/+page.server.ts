import type { Actions } from './$types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

import type { SupabaseClient } from '@supabase/supabase-js';

// Helper to get courier ID (single row by role, indexed)
async function getCourierId(supabase: SupabaseClient): Promise<string | null> {
	const { data: courierData } = await supabase
		.from('profiles')
		.select('id')
		.eq('role', 'courier')
		.single();

	return courierData?.id ?? null;
}

// Helper to notify courier
async function notifyCourier(
	supabase: SupabaseClient,
	session: { access_token: string },
	serviceId: string,
	subject: string,
	message: string
) {
	try {
		const courierId = await getCourierId(supabase);

		if (!courierId) return;

		await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${session.access_token}`,
				'apikey': PUBLIC_SUPABASE_ANON_KEY
			},
			body: JSON.stringify({
				type: 'both',
				user_id: courierId,
				subject,
				message,
				service_id: serviceId,
				url: `/courier/services/${serviceId}`
			})
		});
	} catch (error) {
		console.error('Notification error:', error);
	}
}

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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
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

		// Notify courier
		await notifyCourier(
			supabase,
			session,
			serviceId,
			'Sugestão Aceite',
			'O cliente aceitou a data sugerida para o serviço.'
		);

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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
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

		// Notify courier
		await notifyCourier(
			supabase,
			session,
			serviceId,
			'Sugestão Recusada',
			'O cliente recusou a data sugerida. O pedido está novamente pendente.'
		);

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

		// Accept each suggestion
		let failCount = 0;
		for (const svc of servicesData) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { error } = await (supabase as any)
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
				.eq('id', svc.id);
			if (error) failCount++;
		}

		// Notify courier about batch acceptance
		await notifyCourier(
			supabase,
			session,
			servicesData[0].id,
			'Sugestões Aceites',
			`O cliente aceitou ${servicesData.length} sugestão(ões) de data.`
		);

		if (failCount > 0) {
			return { success: true, error: `${failCount} of ${serviceIds.length} failed` };
		}
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

		// Decline all
		let failCount = 0;
		for (const svc of servicesData) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { error } = await (supabase as any)
				.from('services')
				.update({
					request_status: 'pending',
					suggested_date: null,
					suggested_time_slot: null,
					suggested_time: null
				})
				.eq('id', svc.id);
			if (error) failCount++;
		}

		await notifyCourier(
			supabase,
			session,
			servicesData[0].id,
			'Sugestões Recusadas',
			`O cliente recusou ${servicesData.length} sugestão(ões). Os pedidos estão novamente pendentes.`
		);

		if (failCount > 0) {
			return { success: true, error: `${failCount} of ${serviceIds.length} failed` };
		}
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

		// Get the service and verify ownership + status
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, request_status')
			.eq('id', serviceId)
			.single();

		if (!serviceData) {
			return { success: false, error: 'Service not found' };
		}

		const service = serviceData as { client_id: string; request_status: string };

		if (service.client_id !== user.id) {
			return { success: false, error: 'Unauthorized' };
		}

		// Only allow cancellation of pending requests
		if (service.request_status !== 'pending') {
			return { success: false, error: 'Only pending requests can be cancelled' };
		}

		// Soft delete by setting deleted_at
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				deleted_at: new Date().toISOString()
			})
			.eq('id', serviceId);

		if (updateError) {
			console.error('Failed to cancel request:', updateError);
			return { success: false, error: 'Failed to cancel request' };
		}

		// Notify courier
		await notifyCourier(
			supabase,
			session,
			serviceId,
			'Pedido Cancelado',
			'O cliente cancelou um pedido de serviço pendente.'
		);

		return { success: true };
	}
};
