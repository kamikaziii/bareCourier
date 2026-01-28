import type { Actions } from './$types';
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

		if (newTimeSlot === 'specific' && !newTime) {
			return { success: false, error: 'Specific time is required when "specific" time slot is selected' };
		}

		// Call the bulk reschedule RPC function (single atomic operation)
		// The RPC handles validation, updates services, and creates history records atomically
		// RPC uses auth.uid() internally for security - no need to pass user ID
		const { data: rpcResult, error: rpcError } = await supabase.rpc(
			'bulk_reschedule_services',
			{
				p_service_ids: serviceIds,
				p_new_date: newDate,
				p_new_time_slot: newTimeSlot,
				p_new_time: newTime || undefined,
				p_reason: reason || 'Batch reschedule'
			}
		);

		if (rpcError) {
			console.error('Failed to bulk reschedule services:', rpcError);
			return { success: false, error: 'Failed to reschedule services' };
		}

		const bulkResult = rpcResult as {
			success: boolean;
			error?: string;
			updated_count: number;
			client_notifications?: Array<{ client_id: string; service_ids: string[] }>;
		};

		if (!bulkResult.success) {
			return { success: false, error: bulkResult.error || 'Reschedule failed' };
		}

		const results = { success: bulkResult.updated_count, failed: 0 };

		// Build client notifications map from RPC result
		const clientNotifications: Map<string, string[]> = new Map();
		if (bulkResult.client_notifications) {
			for (const notification of bulkResult.client_notifications) {
				clientNotifications.set(notification.client_id, notification.service_ids);
			}
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
