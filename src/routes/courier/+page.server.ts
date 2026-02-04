import type { Actions, PageServerLoad } from './$types';
import { notifyClient } from '$lib/services/notifications.js';
import { formatDatePtPT } from '$lib/utils/date-format.js';

// Process notifications in chunks to avoid overwhelming the system
const NOTIFICATION_CHUNK_SIZE = 5;
const APP_URL = 'https://barecourier.vercel.app';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	if (!user) {
		return { services: [] };
	}

	// Load all services (filtering happens client-side for better UX)
	const { data: services } = await supabase
		.from('services')
		.select('*, profiles!client_id(name)')
		.is('deleted_at', null)
		.order('scheduled_date', { ascending: true, nullsFirst: false })
		.order('created_at', { ascending: false });

	return {
		services: services || []
	};
};

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

		const MAX_BATCH_SIZE = 50;

		if (serviceIds.length > MAX_BATCH_SIZE) {
			return {
				success: false,
				error: `Maximum ${MAX_BATCH_SIZE} services per batch. Please select fewer services.`
			};
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
		const formattedDate = formatDatePtPT(newDate);

		// Fetch service data for email templates
		const { data: servicesData } = await supabase
			.from('services')
			.select('id, client_id, pickup_location, delivery_location')
			.in('id', serviceIds);

		const servicesMap = new Map(
			(servicesData || []).map((s) => [s.id, s as { id: string; client_id: string; pickup_location: string; delivery_location: string }])
		);

		// Process notifications in chunks to avoid overwhelming the system
		const notificationsToSend = Array.from(clientNotifications).map(([clientId, serviceIdList]) => {
			const count = serviceIdList.length;
			const message =
				count === 1
					? `A sua entrega foi reagendada para ${formattedDate}.`
					: `${count} entregas foram reagendadas para ${formattedDate}.`;

			// Get first service for email template data
			const firstService = servicesMap.get(serviceIdList[0]);

			return {
				session,
				clientId,
				serviceId: serviceIdList[0], // Link to first service
				category: 'schedule_change' as const,
				title: 'Entregas Reagendadas',
				message,
				emailTemplate: 'request_accepted' as const,
				emailData: {
					pickup_location: firstService?.pickup_location || '',
					delivery_location: firstService?.delivery_location || '',
					scheduled_date: newDate,
					app_url: APP_URL
				}
			};
		});

		for (let i = 0; i < notificationsToSend.length; i += NOTIFICATION_CHUNK_SIZE) {
			const chunk = notificationsToSend.slice(i, i + NOTIFICATION_CHUNK_SIZE);
			await Promise.all(chunk.map((notification) => notifyClient(notification)));
		}

		return { success: true, results };
	}
};
