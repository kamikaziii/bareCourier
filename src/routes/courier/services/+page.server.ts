import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import {
	calculateServicePrice,
	getCourierPricingSettings,
	getClientPricing
} from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';

export const actions: Actions = {
	createService: async ({ request, locals: { supabase, safeGetSession } }) => {
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

		const client_id = formData.get('client_id') as string;
		const pickup_location = formData.get('pickup_location') as string;
		const delivery_location = formData.get('delivery_location') as string;
		const notes = (formData.get('notes') as string) || null;
		const scheduled_date = (formData.get('scheduled_date') as string) || null;
		const scheduled_time_slot = (formData.get('scheduled_time_slot') as string) || null;
		const scheduled_time = (formData.get('scheduled_time') as string) || null;
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

		if (!client_id || !pickup_location || !delivery_location) {
			return fail(400, { error: 'Client, pickup, and delivery are required' });
		}

		if (scheduled_time_slot === 'specific' && !scheduled_time) {
			return fail(400, { error: 'Specific time is required when "specific" time slot is selected' });
		}

		const courierSettings = await getCourierPricingSettings(supabase);

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

		const { config: pricingConfig } = await getClientPricing(supabase, client_id);

		let calculated_price: number | null = null;
		let price_breakdown: object | null = null;
		let warning: string | null = null;

		if (!pricingConfig) {
			warning = 'service_created_no_pricing';
		} else if (distance_km !== null) {
			const priceResult = await calculateServicePrice(supabase, {
				clientId: client_id,
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

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: insertError } = await (supabase as any).from('services').insert({
			client_id,
			pickup_location,
			delivery_location,
			notes,
			scheduled_date,
			scheduled_time_slot,
			scheduled_time: scheduled_time_slot === 'specific' ? scheduled_time : null,
			pickup_lat,
			pickup_lng,
			delivery_lat,
			delivery_lng,
			distance_km,
			urgency_fee_id: urgency_fee_id || null,
			calculated_price,
			price_breakdown,
			request_status: 'accepted', // Courier-created services are auto-accepted
			vat_rate_snapshot: courierSettings.vatRate ?? 0,
			prices_include_vat_snapshot: courierSettings.pricesIncludeVat
		});

		if (insertError) {
			console.error('Failed to create service:', insertError);
			return fail(500, { error: 'Failed to create service' });
		}

		return { success: true, warning };
	},

	batchStatusChange: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if ((profile as { role: string } | null)?.role !== 'courier') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		let serviceIds: string[];
		try {
			serviceIds = JSON.parse(formData.get('service_ids') as string);
		} catch {
			return fail(400, { error: 'Invalid service selection' });
		}

		const status = formData.get('status') as string;
		if (!serviceIds?.length || !['pending', 'delivered'].includes(status)) {
			return fail(400, { error: 'Invalid request' });
		}

		const updateData: Record<string, unknown> = {
			status,
			updated_at: new Date().toISOString()
		};
		if (status === 'delivered') {
			updateData.delivered_at = new Date().toISOString();
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update(updateData)
			.in('id', serviceIds);

		if (updateError) {
			console.error('Failed to update batch service status:', updateError);
			return fail(500, { error: 'Failed to update service status' });
		}

		return { success: true };
	}
};
