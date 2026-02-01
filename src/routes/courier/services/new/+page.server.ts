import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	calculateServicePrice,
	getCourierPricingSettings,
	getClientPricing
} from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';
import {
	getServiceTypes,
	getDistributionZones,
	calculateTypedPrice,
	type TypePricingInput
} from '$lib/services/type-pricing.js';
import type { ServiceType, DistributionZone } from '$lib/database.types.js';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, '/login');
	}

	// Get courier's pricing mode and visibility settings
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('pricing_mode, time_specific_price, out_of_zone_base, out_of_zone_per_km, show_price_to_courier')
		.eq('role', 'courier')
		.limit(1)
		.single();

	const pricingMode = (courierProfile?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse';
	const showPriceToCourier = courierProfile?.show_price_to_courier ?? true;

	// Load type-based pricing data only if mode is 'type'
	let serviceTypes: ServiceType[] = [];
	let distributionZones: DistributionZone[] = [];
	let typePricingSettings = {
		timeSpecificPrice: 0,
		outOfZoneBase: 0,
		outOfZonePerKm: 0
	};

	if (pricingMode === 'type') {
		const [types, zones] = await Promise.all([
			getServiceTypes(supabase),
			getDistributionZones(supabase)
		]);

		serviceTypes = types;
		distributionZones = zones;
		typePricingSettings = {
			timeSpecificPrice: courierProfile?.time_specific_price ?? 0,
			outOfZoneBase: courierProfile?.out_of_zone_base ?? 0,
			outOfZonePerKm: courierProfile?.out_of_zone_per_km ?? 0
		};
	}

	return {
		pricingMode,
		serviceTypes,
		distributionZones,
		typePricingSettings,
		showPriceToCourier
	};
};

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
		const recipient_name = (formData.get('recipient_name') as string) || null;
		const recipient_phone = (formData.get('recipient_phone') as string) || null;
		const customer_reference = (formData.get('customer_reference') as string) || null;
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

		// Type-based pricing fields
		const service_type_id = (formData.get('service_type_id') as string) || null;
		const has_time_preference = formData.get('has_time_preference') === 'true';

		// Delivery zone fields
		const is_out_of_zone = formData.get('is_out_of_zone') === 'true';
		const detected_municipality = (formData.get('detected_municipality') as string) || null;

		// Pickup zone fields (new)
		const pickup_is_out_of_zone = formData.get('pickup_is_out_of_zone') === 'true';
		const pickup_detected_municipality = (formData.get('pickup_detected_municipality') as string) || null;

		// Combined out-of-zone: true if EITHER pickup OR delivery is out of zone
		const combined_is_out_of_zone = pickup_is_out_of_zone || is_out_of_zone;

		const tollsStr = formData.get('tolls') as string;
		const tolls = tollsStr ? parseFloat(tollsStr) : null;

		if (!client_id || !pickup_location || !delivery_location) {
			return fail(400, { error: 'Client, pickup, and delivery are required' });
		}

		if (scheduled_time_slot === 'specific' && !scheduled_time) {
			return fail(400, { error: 'Specific time is required when "specific" time slot is selected' });
		}

		const courierSettings = await getCourierPricingSettings(supabase);

		let distance_km: number | null = null;
		let duration_minutes: number | null = null;
		let distanceResult: {
			totalDistanceKm: number;
			distanceMode: string;
			warehouseToPickupKm?: number;
			pickupToDeliveryKm: number;
			durationMinutes?: number;
			source: 'api' | 'haversine';
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

		// Get courier's pricing mode
		const { data: courierModeResult } = await supabase
			.from('profiles')
			.select('pricing_mode')
			.eq('role', 'courier')
			.limit(1)
			.single();

		const pricingMode = (courierModeResult?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse';

		let calculated_price: number | null = null;
		let price_breakdown: import('$lib/database.types').PriceBreakdown | null = null;
		let warning: string | null = null;

		if (pricingMode === 'type' && service_type_id) {
			// Use type-based pricing (combined: either pickup or delivery out of zone)
			const typePricingInput: TypePricingInput = {
				serviceTypeId: service_type_id,
				hasTimePreference: has_time_preference,
				isOutOfZone: combined_is_out_of_zone,
				distanceKm: distance_km,
				tolls: tolls
			};

			const typeResult = await calculateTypedPrice(supabase, typePricingInput);

			if (typeResult.success && typeResult.price !== null) {
				calculated_price = typeResult.price;
				// Store type breakdown in price_breakdown
				if (typeResult.breakdown) {
					price_breakdown = {
						base: typeResult.breakdown.base,
						distance: typeResult.breakdown.distance,
						urgency: 0,
						total: typeResult.breakdown.total,
						model: 'type',
						distance_km: distance_km ?? 0,
						// Route calculation source for audit trail
						route_source: distanceResult?.source,
						// Type-based pricing specific fields
						tolls: typeResult.breakdown.tolls,
						reason: typeResult.breakdown.reason,
						service_type_name: typeResult.breakdown.serviceTypeName
					};
				}
			}
		} else {
			// Use traditional distance-based pricing
			const { config: pricingConfig } = await getClientPricing(supabase, client_id);

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
					// Add route calculation source to breakdown for audit trail
					if (price_breakdown && distanceResult?.source) {
						price_breakdown = { ...price_breakdown, route_source: distanceResult.source };
					}
				}
			}
		}

		const { error: insertError } = await supabase.from('services').insert({
			client_id,
			pickup_location,
			delivery_location,
			notes,
			recipient_name,
			recipient_phone,
			customer_reference,
			scheduled_date,
			scheduled_time_slot,
			scheduled_time: scheduled_time_slot === 'specific' ? scheduled_time : null,
			pickup_lat,
			pickup_lng,
			delivery_lat,
			delivery_lng,
			distance_km,
			duration_minutes,
			urgency_fee_id: urgency_fee_id || null,
			calculated_price,
			price_breakdown,
			request_status: 'accepted', // Courier-created services are auto-accepted
			vat_rate_snapshot: courierSettings.vatRate ?? 0,
			prices_include_vat_snapshot: courierSettings.pricesIncludeVat,
			// Type-based pricing fields
			service_type_id: service_type_id || null,
			has_time_preference,
			// Delivery zone fields
			is_out_of_zone,
			detected_municipality,
			// Pickup zone fields
			pickup_is_out_of_zone,
			pickup_detected_municipality,
			tolls
		});

		if (insertError) {
			console.error('Failed to create service:', insertError);
			return fail(500, { error: 'Failed to create service' });
		}

		return { success: true, warning };
	}
};
