import type { Actions } from './$types';
import type { Service } from '$lib/database.types';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Helper to send notification
async function notifyClient(
	session: { access_token: string },
	clientId: string,
	serviceId: string,
	subject: string,
	message: string
) {
	try {
		await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${session.access_token}`,
				apikey: PUBLIC_SUPABASE_ANON_KEY
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
	} catch (error) {
		console.error('Notification error:', error);
	}
}

export const actions: Actions = {
	batchReschedule: async ({ request, locals: { supabase, safeGetSession } }) => {
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

		if ((profile as { role: string } | null)?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();

		// Parse service IDs with error handling
		let serviceIds: string[];
		try {
			const serviceIdsRaw = formData.get('service_ids') as string;
			if (!serviceIdsRaw) {
				return { success: false, error: 'No services selected' };
			}
			serviceIds = JSON.parse(serviceIdsRaw) as string[];
		} catch {
			return { success: false, error: 'Invalid service selection' };
		}

		const newDate = formData.get('date') as string;
		const newTimeSlot = formData.get('time_slot') as string;
		const newTime = (formData.get('time') as string) || null;
		const reason = formData.get('reason') as string;

		if (!serviceIds || serviceIds.length === 0) {
			return { success: false, error: 'No services selected' };
		}

		if (!newDate || !newTimeSlot) {
			return { success: false, error: 'Date and time slot required' };
		}

		// Get all selected services
		const { data: services } = await supabase
			.from('services')
			.select(
				'id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, reschedule_count, status'
			)
			.in('id', serviceIds)
			.eq('status', 'pending');

		if (!services || services.length === 0) {
			return { success: false, error: 'No pending services found' };
		}

		const results: { success: number; failed: number } = { success: 0, failed: 0 };
		const clientNotifications: Map<string, string[]> = new Map();

		for (const service of services as Service[]) {
			// Update service
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { error: updateError } = await (supabase as any)
				.from('services')
				.update({
					scheduled_date: newDate,
					scheduled_time_slot: newTimeSlot,
					scheduled_time: newTime,
					reschedule_count: (service.reschedule_count || 0) + 1,
					last_rescheduled_at: new Date().toISOString(),
					last_rescheduled_by: user.id
				})
				.eq('id', service.id);

			if (updateError) {
				results.failed++;
				continue;
			}

			// Create history record
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (supabase as any).from('service_reschedule_history').insert({
				service_id: service.id,
				initiated_by: user.id,
				initiated_by_role: 'courier',
				old_date: service.scheduled_date,
				old_time_slot: service.scheduled_time_slot,
				old_time: service.scheduled_time,
				new_date: newDate,
				new_time_slot: newTimeSlot,
				new_time: newTime,
				reason: reason || 'Batch reschedule',
				approval_status: 'auto_approved'
			});

			results.success++;

			// Group notifications by client
			const clientServices = clientNotifications.get(service.client_id) || [];
			clientServices.push(service.id);
			clientNotifications.set(service.client_id, clientServices);
		}

		// Send grouped notifications to clients
		const formattedDate = new Date(newDate).toLocaleDateString('pt-PT', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		for (const [clientId, serviceIdList] of clientNotifications) {
			const count = serviceIdList.length;
			const message =
				count === 1
					? `A sua entrega foi reagendada para ${formattedDate}.`
					: `${count} entregas foram reagendadas para ${formattedDate}.`;

			await notifyClient(
				session,
				clientId,
				serviceIdList[0], // Link to first service
				'Entregas Reagendadas',
				message
			);
		}

		return { success: true, results };
	}
};
