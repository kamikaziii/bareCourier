import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, Profile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import {
	calculateServicePrice,
	getCourierPricingSettings,
	getClientPricing
} from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load service with client info
	const { data: service, error: serviceError } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name)')
		.eq('id', params.id)
		.single();

	if (serviceError || !service) {
		error(404, 'Service not found');
	}

	// Load all active clients for client selection
	const { data: clients } = await supabase
		.from('profiles')
		.select('id, name, default_pickup_location')
		.eq('role', 'client')
		.eq('active', true)
		.order('name');

	return {
		service: service as Service & { profiles: Pick<Profile, 'id' | 'name'> },
		clients: (clients || []) as Pick<Profile, 'id' | 'name' | 'default_pickup_location'>[]
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals: { supabase, safeGetSession } }) => {
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

		const client_id = formData.get('client_id') as string;
		const pickup_location = formData.get('pickup_location') as string;
		const delivery_location = formData.get('delivery_location') as string;
		const notes = formData.get('notes') as string;
		const scheduled_date = (formData.get('scheduled_date') as string) || null;
		const scheduled_time_slot = (formData.get('scheduled_time_slot') as string) || null;
		const scheduled_time = (formData.get('scheduled_time') as string) || null;
		const pickup_lat = formData.get('pickup_lat') ? parseFloat(formData.get('pickup_lat') as string) : null;
		const pickup_lng = formData.get('pickup_lng') ? parseFloat(formData.get('pickup_lng') as string) : null;
		const delivery_lat = formData.get('delivery_lat') ? parseFloat(formData.get('delivery_lat') as string) : null;
		const delivery_lng = formData.get('delivery_lng') ? parseFloat(formData.get('delivery_lng') as string) : null;
		const distance_km = formData.get('distance_km') ? parseFloat(formData.get('distance_km') as string) : null;
		const urgency_fee_id = (formData.get('urgency_fee_id') as string) || null;

		if (!client_id || !pickup_location || !delivery_location) {
			return { success: false, error: 'Required fields missing' };
		}

		if (scheduled_time_slot === 'specific' && !scheduled_time) {
			return { success: false, error: 'Specific time is required when "specific" time slot is selected' };
		}

		// Recalculate pricing
		const courierSettings = await getCourierPricingSettings(supabase);

		let recalculated_distance_km = distance_km;
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
			recalculated_distance_km = distanceResult.totalDistanceKm;
		}

		const { config: pricingConfig } = await getClientPricing(supabase, client_id);

		let calculated_price: number | null = null;
		let price_breakdown: object | null = null;

		if (pricingConfig && recalculated_distance_km !== null) {
			const priceResult = await calculateServicePrice(supabase, {
				clientId: client_id,
				distanceKm: recalculated_distance_km,
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
		const { error: updateError } = await (supabase as any)
			.from('services')
			.update({
				client_id,
				pickup_location,
				delivery_location,
				notes: notes || null,
				scheduled_date,
				scheduled_time_slot,
				scheduled_time: scheduled_time_slot === 'specific' ? scheduled_time : null,
				pickup_lat,
				pickup_lng,
				delivery_lat,
				delivery_lng,
				distance_km: recalculated_distance_km,
				urgency_fee_id: urgency_fee_id || null,
				calculated_price,
				price_breakdown,
				vat_rate_snapshot: courierSettings.vatRate ?? 0,
				prices_include_vat_snapshot: courierSettings.pricesIncludeVat,
				updated_at: new Date().toISOString()
			})
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		redirect(303, localizeHref(`/courier/services/${params.id}`));
	}
};
