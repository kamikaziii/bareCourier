import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, ServiceStatusHistory, Profile, ServiceType } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import { notifyClient } from '$lib/services/notifications.js';
import { formatDatePtPT, formatDateTimePtPT } from '$lib/utils/date-format.js';

const APP_URL = 'https://barecourier.vercel.app';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load service with client info and service type
	const { data: service, error: serviceError } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone, default_pickup_location), service_types(id, name, price)')
		.eq('id', params.id)
		.single();

	if (serviceError || !service) {
		error(404, 'Service not found');
	}

	// Load status history
	const { data: statusHistory } = await supabase
		.from('service_status_history')
		.select('*, profiles!changed_by(name)')
		.eq('service_id', params.id)
		.order('changed_at', { ascending: false });

	return {
		service: service as Service & {
			profiles: Pick<Profile, 'id' | 'name' | 'phone' | 'default_pickup_location'>;
			service_types: Pick<ServiceType, 'id' | 'name' | 'price'> | null;
		},
		statusHistory: (statusHistory || []) as (ServiceStatusHistory & { profiles: { name: string } | null })[]
	};
};

export const actions: Actions = {
	updateStatus: async ({ params, request, locals: { supabase, safeGetSession } }) => {
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
		const newStatus = formData.get('status');

		// Input validation
		if (newStatus !== 'pending' && newStatus !== 'delivered') {
			return { success: false, error: 'Invalid status value' };
		}

		const deliveredAt = newStatus === 'delivered' ? new Date().toISOString() : null;
		const updates: Partial<Service> = {
			status: newStatus,
			delivered_at: deliveredAt
		};

		// Get service details for notification before update
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, pickup_location, delivery_location')
			.eq('id', params.id)
			.single();

		const { error: updateError } = await supabase
			.from('services')
			.update(updates)
			.eq('id', params.id);

		if (updateError) {
			console.error('Failed to update service status:', updateError);
			return { success: false, error: 'Failed to update service status' };
		}

		// Notify client when marked as delivered
		if (newStatus === 'delivered' && serviceData) {
			const service = serviceData as { client_id: string; pickup_location: string; delivery_location: string };
			const formattedDeliveredAt = formatDateTimePtPT(new Date());

			try {
				await notifyClient({
					session,
					clientId: service.client_id,
					serviceId: params.id,
					category: 'service_status',
					title: 'Serviço Entregue',
					message: 'O seu serviço foi marcado como entregue.',
					emailTemplate: 'delivered',
					emailData: {
						pickup_location: service.pickup_location,
						delivery_location: service.delivery_location,
						delivered_at: formattedDeliveredAt,
						app_url: APP_URL
					}
				});
			} catch (error) {
				console.error('Notification failed for service', params.id, error);
			}
		}

		return { success: true };
	},

	deleteService: async ({ params, locals: { supabase, safeGetSession } }) => {
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

		// Soft delete
		const { error: deleteError } = await supabase
			.from('services')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', params.id);

		if (deleteError) {
			console.error('Failed to delete service:', deleteError);
			return { success: false, error: 'Failed to delete service' };
		}

		redirect(303, localizeHref('/courier/services'));
	},

	overridePrice: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const override_price = parseFloat(formData.get('override_price') as string);
		const override_reason = (formData.get('override_reason') as string) || null;

		if (isNaN(override_price) || override_price < 0) {
			return fail(400, { error: 'Invalid price' });
		}

		const { error: updateError } = await supabase
			.from('services')
			.update({
				calculated_price: override_price,
				price_override_reason: override_reason
			})
			.eq('id', params.id);

		if (updateError) {
			console.error('Failed to update service price:', updateError);
			return fail(500, { error: 'Failed to update service price' });
		}

		return { success: true, message: 'price_updated' };
	},

	reschedule: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const newDate = formData.get('date') as string;
		const newTimeSlot = formData.get('time_slot') as string;
		const newTime = formData.get('time') as string | null;
		const reason = formData.get('reason') as string;

		if (!newDate || !newTimeSlot) {
			return { success: false, error: 'Date and time slot required' };
		}

		// Validate date format (YYYY-MM-DD)
		if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
			return { success: false, error: 'Invalid date format' };
		}

		// Validate time slot
		const validTimeSlots = ['morning', 'afternoon', 'evening', 'specific'];
		if (!validTimeSlots.includes(newTimeSlot)) {
			return { success: false, error: 'Invalid time slot' };
		}

		// Validate specific time slot requires a time value
		if (newTimeSlot === 'specific' && !newTime) {
			return { success: false, error: 'Specific time is required when "specific" time slot is selected' };
		}

		const requestApproval = formData.get('request_approval') === '1';

		if (requestApproval) {
			// Pending reschedule: store in pending fields, client must approve
			const { data: serviceData } = await supabase
				.from('services')
				.select('*')
				.eq('id', params.id)
				.single();

			if (!serviceData) {
				return { success: false, error: 'Service not found' };
			}
			const service = serviceData as Service;

			// Guard: don't overwrite an existing pending reschedule
			if (service.pending_reschedule_date) {
				return { success: false, error: 'A pending reschedule already exists for this service' };
			}

			// Set pending fields (don't change scheduled_*)
			const { error: updateError } = await supabase.from('services').update({
				pending_reschedule_date: newDate,
				pending_reschedule_time_slot: newTimeSlot,
				pending_reschedule_time: newTime || null,
				pending_reschedule_reason: reason || null,
				pending_reschedule_requested_at: new Date().toISOString(),
				pending_reschedule_requested_by: user.id
			}).eq('id', params.id);

			if (updateError) {
				console.error('Failed to create pending reschedule:', updateError);
				return { success: false, error: 'Failed to submit reschedule' };
			}

			// Create history record
			await supabase.from('service_reschedule_history').insert({
				service_id: params.id,
				initiated_by: user.id,
				initiated_by_role: 'courier',
				old_date: service.scheduled_date,
				old_time_slot: service.scheduled_time_slot,
				old_time: service.scheduled_time,
				new_date: newDate,
				new_time_slot: newTimeSlot,
				new_time: newTime || null,
				reason: reason || null,
				approval_status: 'pending'
			});

			// Notify client
			const formattedDate = formatDatePtPT(newDate);
			const reasonText = reason ? ` Motivo: ${reason}` : '';
			await supabase.from('notifications').insert({
				user_id: service.client_id,
				type: 'schedule_change',
				title: 'Proposta de Reagendamento',
				message: `O estafeta propõe reagendar para ${formattedDate}.${reasonText}`,
				service_id: params.id
			});

			return { success: true, pendingApproval: true };
		} else {
			// Immediate reschedule (existing flow)
			const formattedDate = formatDatePtPT(newDate);
			const reasonText = reason ? ` Motivo: ${reason}` : '';
			const notificationMessage = `A sua entrega foi reagendada para ${formattedDate}.${reasonText}`;

			const { data, error: rpcError } = await supabase.rpc('reschedule_service', {
				p_service_id: params.id,
				p_new_date: newDate,
				p_new_time_slot: newTimeSlot,
				p_new_time: newTime || undefined,
				p_reason: reason || undefined,
				p_notification_title: 'Entrega Reagendada',
				p_notification_message: notificationMessage
			});

			if (rpcError) {
				console.error('Failed to reschedule service:', rpcError);
				return { success: false, error: 'Failed to reschedule service' };
			}

			const result = data as { success: boolean; error?: string };
			if (!result.success) {
				return { success: false, error: result.error || 'Reschedule failed' };
			}

			return { success: true };
		}
	}
};
