import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, ServiceStatusHistory, Profile, PastDueSettings, ServiceType } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import { notifyCourier } from '$lib/services/notifications.js';
import { formatDatePtPT } from '$lib/utils/date-format.js';
import { APP_URL } from '$lib/constants.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load service with service_types join (RLS ensures client can only see their own)
	const { data: serviceData, error: serviceError } = await supabase
		.from('services')
		.select('*, service_types(id, name, price)')
		.eq('id', params.id)
		.eq('client_id', user.id)
		.single();

	if (serviceError || !serviceData) {
		error(404, 'Service not found');
	}

	const service = serviceData as Service & {
		service_types: Pick<ServiceType, 'id' | 'name' | 'price'> | null;
	};

	// Load status history
	const { data: statusHistoryData } = await supabase
		.from('service_status_history')
		.select('*')
		.eq('service_id', params.id)
		.order('changed_at', { ascending: false });

	// Load courier's reschedule settings, price visibility, and label branding
	const { data: courierSettingsData } = await supabase
		.from('profiles')
		.select('name, phone, past_due_settings, show_price_to_client, label_business_name, label_tagline')
		.eq('role', 'courier')
		.single();

	const courierSettings = courierSettingsData as Pick<Profile, 'name' | 'phone' | 'past_due_settings' | 'show_price_to_client' | 'label_business_name' | 'label_tagline'> | null;
	const settings = courierSettings?.past_due_settings as PastDueSettings | null;
	const rescheduleSettings = {
		allowed: settings?.allowClientReschedule ?? true,
		minNoticeHours: settings?.clientMinNoticeHours ?? 24,
		maxReschedules: settings?.clientMaxReschedules ?? 3
	};
	const showPriceToClient = courierSettings?.show_price_to_client ?? true;

	return {
		service,
		statusHistory: (statusHistoryData || []) as ServiceStatusHistory[],
		rescheduleSettings,
		showPriceToClient,
		courierProfile: courierSettings ? {
			name: courierSettings.name,
			phone: courierSettings.phone,
			label_business_name: courierSettings.label_business_name,
			label_tagline: courierSettings.label_tagline
		} : null
	};
};

export const actions: Actions = {
	requestReschedule: async ({ params, request, locals: { supabase, safeGetSession } }) => {
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

		// Validate specific time slot requires a time value
		if (newTimeSlot === 'specific' && !newTime) {
			return { success: false, error: 'Specific time is required when "specific" time slot is selected' };
		}

		// Get service and verify ownership
		const { data: serviceData } = await supabase
			.from('services')
			.select('*')
			.eq('id', params.id)
			.eq('client_id', user.id)
			.single();

		if (!serviceData) {
			return { success: false, error: 'Service not found' };
		}

		const service = serviceData as Service;

		// Only pending services can be rescheduled
		if (service.status !== 'pending') {
			return { success: false, error: 'Only pending services can be rescheduled' };
		}

		// Get courier's reschedule settings
		const { data: courierProfileData } = await supabase
			.from('profiles')
			.select('id, past_due_settings')
			.eq('role', 'courier')
			.single();

		const courierProfile = courierProfileData as Pick<Profile, 'id' | 'past_due_settings'> | null;
		const settings = courierProfile?.past_due_settings as PastDueSettings | null;
		const allowClientReschedule = settings?.allowClientReschedule ?? true;
		const clientMinNoticeHours = settings?.clientMinNoticeHours ?? 24;
		const clientMaxReschedules = settings?.clientMaxReschedules ?? 3;

		// Check if rescheduling is allowed
		if (!allowClientReschedule) {
			return { success: false, error: 'reschedule_disabled', code: 'DISABLED' };
		}

		// Check max reschedules
		if ((service.reschedule_count || 0) >= clientMaxReschedules) {
			return { success: false, error: 'max_reschedules_reached', code: 'MAX_REACHED' };
		}

		// Check minimum notice (only if service has a scheduled date)
		let needsApproval = false;
		if (service.scheduled_date) {
			const scheduledDateTime = new Date(service.scheduled_date + 'T00:00:00');
			const hoursUntilScheduled = (scheduledDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

			if (hoursUntilScheduled < clientMinNoticeHours) {
				needsApproval = true;
			}
		}

		if (needsApproval) {
			// Create pending reschedule request
			const { error: updateError } = await supabase
				.from('services')
				.update({
					pending_reschedule_date: newDate,
					pending_reschedule_time_slot: newTimeSlot,
					pending_reschedule_time: newTime || null,
					pending_reschedule_reason: reason || null,
					pending_reschedule_requested_at: new Date().toISOString(),
					pending_reschedule_requested_by: user.id
				})
				.eq('id', params.id);

			if (updateError) {
				console.error('Failed to create pending reschedule:', updateError);
				return { success: false, error: 'Failed to submit reschedule request' };
			}

			// Create history record
			await supabase.from('service_reschedule_history').insert({
				service_id: params.id,
				initiated_by: user.id,
				initiated_by_role: 'client',
				old_date: service.scheduled_date,
				old_time_slot: service.scheduled_time_slot,
				old_time: service.scheduled_time,
				new_date: newDate,
				new_time_slot: newTimeSlot,
				new_time: newTime || null,
				reason: reason || null,
				approval_status: 'pending'
			});

			// Get client name for email
			const { data: clientProfile } = await supabase
				.from('profiles')
				.select('name')
				.eq('id', user.id)
				.single();
			const clientName = (clientProfile as { name: string } | null)?.name || 'Cliente';

			// Notify courier with email
			await notifyCourier({
				supabase,
				session,
				serviceId: params.id,
				category: 'schedule_change',
				title: 'Pedido de Reagendamento',
				message: 'O cliente pediu para reagendar uma entrega. Requer a sua aprovação.',
				emailTemplate: 'request_suggested',  // Reuse existing template
				emailData: {
					client_name: clientName,
					pickup_location: service.pickup_location,
					delivery_location: service.delivery_location,
					requested_date: formatDatePtPT(newDate),
					reason: reason || '',
					app_url: APP_URL
				}
			});

			return { success: true, needsApproval: true };
		} else {
			// Auto-approve: update service directly
			const { error: updateError } = await supabase
				.from('services')
				.update({
					scheduled_date: newDate,
					scheduled_time_slot: newTimeSlot,
					scheduled_time: newTime || null,
					reschedule_count: (service.reschedule_count || 0) + 1,
					last_rescheduled_at: new Date().toISOString(),
					last_rescheduled_by: user.id
				})
				.eq('id', params.id);

			if (updateError) {
				console.error('Failed to auto-approve reschedule:', updateError);
				return { success: false, error: 'Failed to reschedule service' };
			}

			// Create history record
			await supabase.from('service_reschedule_history').insert({
				service_id: params.id,
				initiated_by: user.id,
				initiated_by_role: 'client',
				old_date: service.scheduled_date,
				old_time_slot: service.scheduled_time_slot,
				old_time: service.scheduled_time,
				new_date: newDate,
				new_time_slot: newTimeSlot,
				new_time: newTime || null,
				reason: reason || null,
				approval_status: 'auto_approved'
			});

			// Get client name for email
			const { data: clientProfile } = await supabase
				.from('profiles')
				.select('name')
				.eq('id', user.id)
				.single();
			const clientName = (clientProfile as { name: string } | null)?.name || 'Cliente';

			// Notify courier of auto-approved reschedule with email
			await notifyCourier({
				supabase,
				session,
				serviceId: params.id,
				category: 'schedule_change',
				title: 'Reagendamento Automático',
				message: 'Um cliente reagendou uma entrega automaticamente.',
				emailTemplate: 'request_suggested',  // Reuse existing template
				emailData: {
					client_name: clientName,
					pickup_location: service.pickup_location,
					delivery_location: service.delivery_location,
					new_date: formatDatePtPT(newDate),
					app_url: APP_URL
				}
			});

			return { success: true, needsApproval: false };
		}
	},

	acceptReschedule: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Fetch service data for email template before the RPC (which changes the data)
		const { data: serviceData } = await supabase
			.from('services')
			.select('pickup_location, delivery_location, suggested_date, profiles!client_id(name)')
			.eq('id', params.id)
			.eq('client_id', user.id)
			.single();

		const service = serviceData as {
			pickup_location: string;
			delivery_location: string;
			suggested_date: string | null;
			profiles: { name: string };
		} | null;

		const { data, error: rpcError } = await supabase.rpc('client_approve_reschedule', {
			p_service_id: params.id
		});

		if (rpcError) {
			console.error('Failed to approve reschedule:', rpcError);
			return { success: false, error: 'Failed to approve reschedule' };
		}

		const result = data as { success: boolean; error?: string };
		if (!result.success) {
			return { success: false, error: result.error || 'Failed to approve' };
		}

		// Notify courier with email
		try {
			await notifyCourier({
				supabase,
				session,
				serviceId: params.id,
				category: 'schedule_change',
				title: 'Reagendamento Aceite',
				message: 'O cliente aceitou a proposta de reagendamento.',
				emailTemplate: 'suggestion_accepted',
				emailData: {
					client_name: service?.profiles?.name || 'Cliente',
					pickup_location: service?.pickup_location || 'N/A',
					delivery_location: service?.delivery_location || 'N/A',
					new_date: formatDatePtPT(service?.suggested_date ?? null),
					service_id: params.id,
					app_url: APP_URL
				}
			});
		} catch (error) {
			console.error('Notification failed for acceptReschedule', params.id, error);
		}

		return { success: true };
	},

	declineReschedule: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const reason = (formData.get('reason') as string) || null;

		// Fetch service data for email template
		const { data: serviceData } = await supabase
			.from('services')
			.select('pickup_location, delivery_location, scheduled_date, profiles!client_id(name)')
			.eq('id', params.id)
			.eq('client_id', user.id)
			.single();

		const service = serviceData as {
			pickup_location: string;
			delivery_location: string;
			scheduled_date: string | null;
			profiles: { name: string };
		} | null;

		const { data, error: rpcError } = await supabase.rpc('client_deny_reschedule', {
			p_service_id: params.id,
			p_denial_reason: reason ?? undefined
		});

		if (rpcError) {
			console.error('Failed to decline reschedule:', rpcError);
			return { success: false, error: 'Failed to decline reschedule' };
		}

		const result = data as { success: boolean; error?: string };
		if (!result.success) {
			return { success: false, error: result.error || 'Failed to decline' };
		}

		// Notify courier with email
		const reasonText = reason ? ` Motivo: ${reason}` : '';
		try {
			await notifyCourier({
				supabase,
				session,
				serviceId: params.id,
				category: 'schedule_change',
				title: 'Reagendamento Recusado',
				message: `O cliente recusou a proposta de reagendamento.${reasonText}`,
				emailTemplate: 'suggestion_declined',
				emailData: {
					client_name: service?.profiles?.name || 'Cliente',
					pickup_location: service?.pickup_location || 'N/A',
					delivery_location: service?.delivery_location || 'N/A',
					original_date: formatDatePtPT(service?.scheduled_date ?? null, 'Não agendada'),
					reason: reason || 'Não especificado',
					service_id: params.id,
					app_url: APP_URL
				}
			});
		} catch (error) {
			console.error('Notification failed for declineReschedule', params.id, error);
		}

		return { success: true };
	}
};
