import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, ServiceStatusHistory, Profile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load service with client info
	const { data: service, error: serviceError } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone, default_pickup_location)')
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
		service: service as Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone' | 'default_pickup_location'> },
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

		const updates: Partial<Service> = { status: newStatus };

		if (newStatus === 'delivered') {
			updates.delivered_at = new Date().toISOString();
		} else {
			updates.delivered_at = null;
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update(updates)
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: deleteError } = await (supabase as any)
			.from('services')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', params.id);

		if (deleteError) {
			return { success: false, error: deleteError.message };
		}

		redirect(303, localizeHref('/courier/services'));
	},

	reschedule: async ({ params, request, locals: { supabase, safeGetSession } }) => {
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

		// Get current service for notification
		const { data: serviceData } = await supabase
			.from('services')
			.select('*, profiles!client_id(id, name)')
			.eq('id', params.id)
			.single();

		const service = serviceData as (Service & { profiles: Pick<Profile, 'id' | 'name'> }) | null;

		if (!service) {
			return { success: false, error: 'Service not found' };
		}

		// Update service with new schedule and reschedule tracking
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

		// Create notification for client
		const reasonText = reason ? ` Reason: ${reason}` : '';
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: notifyError } = await (supabase as any).from('notifications').insert({
			user_id: service.client_id,
			type: 'schedule_change',
			title: 'Delivery Rescheduled',
			message: `Your delivery has been rescheduled to ${newDate}.${reasonText}`,
			service_id: params.id
		});

		if (notifyError) {
			console.error('Failed to create reschedule notification:', notifyError);
			// Still return success since the reschedule itself worked
		}

		return { success: true };
	}
};
