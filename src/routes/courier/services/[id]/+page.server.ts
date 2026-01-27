import { error, fail, redirect } from '@sveltejs/kit';
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

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				calculated_price: override_price,
				price_override_reason: override_reason
			})
			.eq('id', params.id);

		if (updateError) {
			return fail(500, { error: updateError.message });
		}

		return { success: true, message: 'price_updated' };
	},

	reschedule: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
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

		// Format date nicely for Portuguese users (primary user base)
		const formattedDate = new Date(newDate).toLocaleDateString('pt-PT', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
		const reasonText = reason ? ` Motivo: ${reason}` : '';
		const notificationMessage = `A sua entrega foi reagendada para ${formattedDate}.${reasonText}`;

		// Call RPC that handles all operations atomically in a transaction
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data, error: rpcError } = await (supabase as any).rpc('reschedule_service', {
			p_service_id: params.id,
			p_new_date: newDate,
			p_new_time_slot: newTimeSlot,
			p_new_time: newTime || null,
			p_reason: reason || null,
			p_notification_title: 'Entrega Reagendada',
			p_notification_message: notificationMessage
		});

		if (rpcError) {
			return { success: false, error: rpcError.message };
		}

		// RPC returns jsonb with success/error info
		const result = data as { success: boolean; error?: string };
		if (!result.success) {
			return { success: false, error: result.error || 'Reschedule failed' };
		}

		return { success: true };
	}
};
