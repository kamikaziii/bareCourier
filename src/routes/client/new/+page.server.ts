import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import {
	calculateServicePrice,
	getCourierPricingSettings,
	getClientPricing
} from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Verify user has client role (defense-in-depth)
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'client') {
			return fail(403, { error: 'Unauthorized' });
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
		let duration_minutes: number | null = null;
		let distanceResult: {
			totalDistanceKm: number;
			distanceMode: string;
			warehouseToPickupKm?: number;
			pickupToDeliveryKm: number;
			durationMinutes?: number;
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
			duration_minutes = distanceResult.durationMinutes ?? null;
		}

		// Check if client has pricing config
		const { config: pricingConfig } = await getClientPricing(supabase, user.id);

		let calculated_price: number | null = null;
		let price_breakdown: import('$lib/database.types').PriceBreakdown | null = null;

		if (!pricingConfig) {
			// No pricing config - allow creation with warning (handled in redirect)
		} else if (distance_km !== null) {
			// Calculate price
			const priceResult = await calculateServicePrice(supabase, {
				clientId: user.id,
				distanceKm: distance_km,
				urgencyFeeId: urgency_fee_id,
				minimumCharge: courierSettings.minimumCharge,
				distanceMode: distanceResult?.distanceMode as 'warehouse' | 'zone' | 'fallback',
				warehouseToPickupKm: distanceResult?.warehouseToPickupKm,
				pickupToDeliveryKm: distanceResult?.pickupToDeliveryKm
			});

			if (priceResult.success) {
				calculated_price = priceResult.price;
				price_breakdown = priceResult.breakdown;
			}
		}

		// Insert service
		const { error: insertError } = await supabase.from('services').insert({
			client_id: user.id,
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
			duration_minutes,
			urgency_fee_id: urgency_fee_id || null,
			calculated_price,
			price_breakdown,
			vat_rate_snapshot: courierSettings.vatRate ?? 0,
			prices_include_vat_snapshot: courierSettings.pricesIncludeVat
		});

		if (insertError) {
			console.error('Failed to create client service request:', insertError);
			return fail(500, { error: 'Failed to create service request' });
		}

		redirect(303, localizeHref('/client'));
	}
};
