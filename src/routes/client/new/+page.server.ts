import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import {
	calculateServicePrice,
	getCourierPricingSettings,
	getClientPricing
} from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';
import {
	getClientDefaultServiceTypeId,
	calculateTypedPrice,
	type TypePricingInput
} from '$lib/services/type-pricing.js';
import { localizeHref, extractLocaleFromRequest } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';
import { notifyCourier } from '$lib/services/notifications.js';
import { formatDatePtPT } from '$lib/utils/date-format.js';
import { APP_URL } from '$lib/constants.js';

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Verify user has client role (defense-in-depth) and get name for notification
		const { data: profile } = await supabase
			.from('profiles')
			.select('role, name')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string; name: string } | null;
		if (userProfile?.role !== 'client') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();

		// Extract form data
		const pickup_location = formData.get('pickup_location') as string;
		const delivery_location = formData.get('delivery_location') as string;
		const notes = (formData.get('notes') as string) || null;
		const recipient_name = (formData.get('recipient_name') as string) || null;
		const recipient_phone = (formData.get('recipient_phone') as string) || null;
		const customer_reference = (formData.get('customer_reference') as string) || null;
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

		// Type-based pricing fields
		const has_time_preference = formData.get('has_time_preference') === 'true';

		// Delivery zone fields
		const is_out_of_zone = formData.get('is_out_of_zone') === 'true';
		const detected_municipality = (formData.get('detected_municipality') as string) || null;

		// Pickup zone fields (new)
		const pickup_is_out_of_zone = formData.get('pickup_is_out_of_zone') === 'true';
		const pickup_detected_municipality = (formData.get('pickup_detected_municipality') as string) || null;

		// Combined out-of-zone: true if EITHER pickup OR delivery is out of zone
		const combined_is_out_of_zone = pickup_is_out_of_zone || is_out_of_zone;

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
		let service_type_id: string | null = null;

		if (pricingMode === 'type') {
			// Get client's default service type for type-based pricing
			service_type_id = await getClientDefaultServiceTypeId(supabase, user.id);

			if (!service_type_id) {
				return fail(400, {
					error: 'no_service_type_assigned',
					message: 'Your account does not have a service type assigned. Please contact the courier.'
				});
			}

			// Use type-based pricing (combined: either pickup or delivery out of zone)
			const typePricingInput: TypePricingInput = {
				serviceTypeId: service_type_id,
				hasTimePreference: has_time_preference,
				isOutOfZone: combined_is_out_of_zone,
				distanceKm: distance_km,
				tolls: null // Clients don't set tolls, courier handles that
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
			const { config: pricingConfig } = await getClientPricing(supabase, user.id);

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
					// Add route calculation source to breakdown for audit trail
					if (price_breakdown && distanceResult?.source) {
						price_breakdown = { ...price_breakdown, route_source: distanceResult.source };
					}
				}
			}
		}

		// Insert service and get the ID for notification
		const { data: insertedService, error: insertError } = await supabase
			.from('services')
			.insert({
				client_id: user.id,
				pickup_location,
				delivery_location,
				notes,
				recipient_name,
				recipient_phone,
				customer_reference,
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
				prices_include_vat_snapshot: courierSettings.pricesIncludeVat,
				// Type-based pricing fields
				service_type_id,
				has_time_preference,
				// Delivery zone fields
				is_out_of_zone,
				detected_municipality,
				// Pickup zone fields
				pickup_is_out_of_zone,
				pickup_detected_municipality,
				tolls: null // Clients don't set tolls
			})
			.select('id')
			.single();

		if (insertError || !insertedService) {
			console.error('Failed to create client service request:', insertError);
			return fail(500, { error: 'Failed to create service request' });
		}

		// Notify courier with email
		const formattedDate = formatDatePtPT(requested_date, 'Não especificada');
		const locale = extractLocaleFromRequest(request);

		try {
			await notifyCourier({
				supabase,
				session,
				serviceId: insertedService.id,
				category: 'new_request',
				title: m.notification_new_service_request({}, { locale }),
				message: `${userProfile?.name || 'Cliente'} criou um novo pedido de serviço.`,
				emailTemplate: 'new_request',
				emailData: {
					client_name: userProfile?.name || 'Cliente',
					pickup_location,
					delivery_location,
					requested_date: formattedDate,
					notes: notes || '',
					app_url: APP_URL
				}
			});
		} catch (error) {
			console.error('Notification failed for new service', insertedService.id, error);
		}

		redirect(303, localizeHref('/client'));
	}
};
