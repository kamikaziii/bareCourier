import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { getCourierPricingSettings } from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const actions: Actions = {
	default: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Verify user has client role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'client') {
			return fail(403, { error: 'Unauthorized' });
		}

		// Verify service exists, belongs to user, and is still pending
		const { data: existingService } = await supabase
			.from('services')
			.select('id, client_id, request_status')
			.eq('id', params.id)
			.eq('client_id', user.id)
			.single();

		if (!existingService) {
			return fail(404, { error: 'Service not found' });
		}

		const svc = existingService as { id: string; client_id: string; request_status: string };
		if (svc.request_status !== 'pending') {
			return fail(400, { error: 'Only pending requests can be edited' });
		}

		const formData = await request.formData();

		// Extract form data
		const pickup_location = formData.get('pickup_location') as string;
		const delivery_location = formData.get('delivery_location') as string;
		const notes = (formData.get('notes') as string) || null;
		const requested_date = (formData.get('requested_date') as string) || null;
		const requested_time_slot = (formData.get('requested_time_slot') as string) || null;
		const requested_time = (formData.get('requested_time') as string) || null;
		const pickup_lat = formData.get('pickup_lat')
			? parseFloat(formData.get('pickup_lat') as string)
			: null;
		const pickup_lng = formData.get('pickup_lng')
			? parseFloat(formData.get('pickup_lng') as string)
			: null;
		const delivery_lat = formData.get('delivery_lat')
			? parseFloat(formData.get('delivery_lat') as string)
			: null;
		const delivery_lng = formData.get('delivery_lng')
			? parseFloat(formData.get('delivery_lng') as string)
			: null;
		const urgency_fee_id = (formData.get('urgency_fee_id') as string) || null;

		// Validate required fields
		if (!pickup_location || !delivery_location) {
			return fail(400, { error: 'Pickup and delivery locations are required' });
		}

		// Validate specific time slot requires a time value
		if (requested_time_slot === 'specific' && !requested_time) {
			return fail(400, { error: 'Specific time is required when "specific" time slot is selected' });
		}

		// Get courier settings
		const courierSettings = await getCourierPricingSettings(supabase);

		// Calculate distance if coordinates available
		let distance_km: number | null = null;
		let distanceResult: {
			totalDistanceKm: number;
			distanceMode: string;
			warehouseToPickupKm?: number;
			pickupToDeliveryKm: number;
		} | null = null;

		if (pickup_lat && pickup_lng && delivery_lat && delivery_lng) {
			distanceResult = await calculateServiceDistance({
				pickupCoords: [pickup_lng, pickup_lat],
				deliveryCoords: [delivery_lng, delivery_lat],
				warehouseCoords: courierSettings.warehouseCoords,
				pricingMode: courierSettings.pricingMode,
				roundDistance: courierSettings.roundDistance
			});
			distance_km = distanceResult.totalDistanceKm;
		}

		// Update service
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any).from('services').update({
			pickup_location,
			delivery_location,
			notes,
			requested_date,
			requested_time_slot,
			requested_time,
			pickup_lat,
			pickup_lng,
			delivery_lat,
			delivery_lng,
			distance_km,
			urgency_fee_id: urgency_fee_id || null
		}).eq('id', params.id);

		if (updateError) {
			console.error('Failed to update client service request:', updateError);
			return fail(500, { error: 'Failed to update service request' });
		}

		redirect(303, localizeHref(`/client/services/${params.id}`));
	}
};
