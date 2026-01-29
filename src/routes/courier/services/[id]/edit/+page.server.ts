import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, Profile, ServiceType } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import {
	calculateServicePrice,
	getCourierPricingSettings,
	getClientPricing
} from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';
import {
	getServiceTypes,
	calculateTypedPrice,
	type TypePricingInput,
	type TypePricingSettings
} from '$lib/services/type-pricing.js';

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

	// Get courier's pricing mode and type-based settings
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('pricing_mode, time_specific_price, out_of_zone_base, out_of_zone_per_km')
		.eq('role', 'courier')
		.limit(1)
		.single();

	const pricingMode = (courierProfile?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse';

	// Load type-based pricing data only if mode is 'type'
	let serviceTypes: ServiceType[] = [];
	let typePricingSettings: TypePricingSettings = {
		timeSpecificPrice: 0,
		outOfZoneBase: 0,
		outOfZonePerKm: 0
	};

	if (pricingMode === 'type') {
		serviceTypes = await getServiceTypes(supabase);
		typePricingSettings = {
			timeSpecificPrice: courierProfile?.time_specific_price ?? 0,
			outOfZoneBase: courierProfile?.out_of_zone_base ?? 0,
			outOfZonePerKm: courierProfile?.out_of_zone_per_km ?? 0
		};
	}

	return {
		service: service as Service & { profiles: Pick<Profile, 'id' | 'name'> },
		clients: (clients || []) as Pick<Profile, 'id' | 'name' | 'default_pickup_location'>[],
		pricingMode,
		serviceTypes,
		typePricingSettings
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

		// Type-based pricing fields
		const service_type_id = (formData.get('service_type_id') as string) || null;
		const has_time_preference = formData.get('has_time_preference') === 'true';
		const is_out_of_zone_str = formData.get('is_out_of_zone') as string;
		const is_out_of_zone = is_out_of_zone_str === 'true' ? true : is_out_of_zone_str === 'false' ? false : null;
		const detected_municipality = (formData.get('detected_municipality') as string) || null;
		const tollsStr = formData.get('tolls') as string;
		const tolls = tollsStr && tollsStr !== '' ? parseFloat(tollsStr) : null;

		if (!client_id || !pickup_location || !delivery_location) {
			return { success: false, error: 'Required fields missing' };
		}

		if (scheduled_time_slot === 'specific' && !scheduled_time) {
			return { success: false, error: 'Specific time is required when "specific" time slot is selected' };
		}

		// Recalculate pricing
		const courierSettings = await getCourierPricingSettings(supabase);

		let recalculated_distance_km = distance_km;
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
			recalculated_distance_km = distanceResult.totalDistanceKm;
			duration_minutes = distanceResult.durationMinutes ?? null;
		}

		let calculated_price: number | null = null;
		let price_breakdown: import('$lib/database.types').PriceBreakdown | null = null;

		// Check pricing mode to determine how to calculate price
		if (courierSettings.pricingMode === 'type' && service_type_id) {
			// Type-based pricing
			const typePricingInput: TypePricingInput = {
				serviceTypeId: service_type_id,
				hasTimePreference: has_time_preference,
				isOutOfZone: is_out_of_zone === true,
				distanceKm: recalculated_distance_km,
				tolls: tolls
			};

			const typeResult = await calculateTypedPrice(supabase, typePricingInput);

			if (typeResult.success && typeResult.price !== null) {
				calculated_price = typeResult.price;
				if (typeResult.breakdown) {
					price_breakdown = {
						base: typeResult.breakdown.base,
						distance: typeResult.breakdown.distance,
						urgency: 0,
						total: typeResult.breakdown.total,
						model: 'type',
						distance_km: recalculated_distance_km ?? 0,
						tolls: typeResult.breakdown.tolls,
						reason: typeResult.breakdown.reason,
						service_type_name: typeResult.breakdown.serviceTypeName
					};
				}
			}
		} else {
			// Distance-based pricing
			const { config: pricingConfig } = await getClientPricing(supabase, client_id);

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
		}

		const { error: updateError } = await supabase
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
				duration_minutes,
				urgency_fee_id: urgency_fee_id || null,
				calculated_price,
				price_breakdown,
				vat_rate_snapshot: courierSettings.vatRate ?? 0,
				prices_include_vat_snapshot: courierSettings.pricesIncludeVat,
				// Type-based pricing fields
				service_type_id: service_type_id || null,
				has_time_preference,
				is_out_of_zone,
				detected_municipality,
				tolls,
				updated_at: new Date().toISOString()
			})
			.eq('id', params.id);

		if (updateError) {
			console.error('Failed to update service:', updateError);
			return { success: false, error: 'Failed to update service' };
		}

		redirect(303, localizeHref(`/courier/services/${params.id}`));
	}
};
