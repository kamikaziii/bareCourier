import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, ServiceStatusHistory, Profile, PastDueSettings } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load service (RLS ensures client can only see their own)
	const { data: serviceData, error: serviceError } = await supabase
		.from('services')
		.select('*')
		.eq('id', params.id)
		.eq('client_id', user.id)
		.single();

	if (serviceError || !serviceData) {
		error(404, 'Service not found');
	}

	const service = serviceData as Service;

	// Load status history
	const { data: statusHistoryData } = await supabase
		.from('service_status_history')
		.select('*')
		.eq('service_id', params.id)
		.order('changed_at', { ascending: false });

	// Load courier's reschedule settings
	const { data: courierSettingsData } = await supabase
		.from('profiles')
		.select('past_due_settings')
		.eq('role', 'courier')
		.single();

	const courierSettings = courierSettingsData as Pick<Profile, 'past_due_settings'> | null;
	const settings = courierSettings?.past_due_settings as PastDueSettings | null;
	const rescheduleSettings = {
		allowed: settings?.allowClientReschedule ?? true,
		minNoticeHours: settings?.clientMinNoticeHours ?? 24,
		maxReschedules: settings?.clientMaxReschedules ?? 3
	};

	return {
		service,
		statusHistory: (statusHistoryData || []) as ServiceStatusHistory[],
		rescheduleSettings
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { error: updateError } = await (supabase as any)
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
				return { success: false, error: updateError.message };
			}

			// Create history record
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (supabase as any).from('service_reschedule_history').insert({
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

			// Notify courier
			if (courierProfile?.id) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await (supabase as any).from('notifications').insert({
					user_id: courierProfile.id,
					type: 'schedule_change',
					title: 'Pedido de Reagendamento',
					message: 'O cliente pediu para reagendar uma entrega.',
					service_id: params.id
				});
			}

			return { success: true, needsApproval: true };
		} else {
			// Auto-approve: update service directly
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { error: updateError } = await (supabase as any)
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
				return { success: false, error: updateError.message };
			}

			// Create history record
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (supabase as any).from('service_reschedule_history').insert({
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

			// Notify courier of auto-approved reschedule
			if (courierProfile?.id) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await (supabase as any).from('notifications').insert({
					user_id: courierProfile.id,
					type: 'schedule_change',
					title: 'Reagendamento Automático',
					message: 'Um cliente reagendou uma entrega automaticamente.',
					service_id: params.id
				});
			}

			return { success: true, needsApproval: false };
		}
	},

	acceptReschedule: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data, error: rpcError } = await (supabase as any).rpc('client_approve_reschedule', {
			p_service_id: params.id
		});

		if (rpcError) {
			return { success: false, error: rpcError.message };
		}

		const result = data as { success: boolean; error?: string };
		if (!result.success) {
			return { success: false, error: result.error || 'Failed to approve' };
		}

		// Notify courier
		const { data: courierData } = await supabase
			.from('profiles')
			.select('id')
			.eq('role', 'courier')
			.single();

		if (courierData) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (supabase as any).from('notifications').insert({
				user_id: (courierData as { id: string }).id,
				type: 'schedule_change',
				title: 'Reagendamento Aceite',
				message: 'O cliente aceitou a proposta de reagendamento.',
				service_id: params.id
			});
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

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data, error: rpcError } = await (supabase as any).rpc('client_deny_reschedule', {
			p_service_id: params.id,
			p_denial_reason: reason
		});

		if (rpcError) {
			return { success: false, error: rpcError.message };
		}

		const result = data as { success: boolean; error?: string };
		if (!result.success) {
			return { success: false, error: result.error || 'Failed to decline' };
		}

		// Notify courier
		const { data: courierData } = await supabase
			.from('profiles')
			.select('id')
			.eq('role', 'courier')
			.single();

		if (courierData) {
			const reasonText = reason ? ` Motivo: ${reason}` : '';
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (supabase as any).from('notifications').insert({
				user_id: (courierData as { id: string }).id,
				type: 'schedule_change',
				title: 'Reagendamento Recusado',
				message: `O cliente recusou a proposta de reagendamento.${reasonText}`,
				service_id: params.id
			});
		}

		return { success: true };
	}
};
