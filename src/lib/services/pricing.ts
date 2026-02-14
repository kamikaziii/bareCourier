/**
 * Pricing Service
 *
 * Calculates service prices based on courier's pricing_mode:
 *
 * 1. Type-based pricing (pricing_mode = 'type'):
 *    - Delegates to type-pricing.ts
 *    - Uses service types, time preferences, and geographic zones
 *    - Out-of-zone deliveries use distance + tolls
 *
 * 2. Distance-based pricing (pricing_mode = 'warehouse' or 'zone'):
 *    - Uses client's pricing configuration (per_km, flat_plus_km, or zone model)
 *    - Applies urgency fees if specified
 *    - Calculates distance from warehouse or pickup point
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PriceBreakdown } from '$lib/database.types';
import { calculateTypedPrice, type TypePricingInput } from './type-pricing.js';

export interface PricingConfig {
	pricing_model: 'per_km' | 'zone' | 'flat_plus_km';
	base_fee: number;
	per_km_rate: number;
}

export interface PricingZone {
	min_km: number;
	max_km: number | null;
	price: number;
}

export interface UrgencyFee {
	id: string;
	name: string;
	multiplier: number;
	flat_fee: number;
}

export interface ServicePricingInput {
	clientId: string;
	distanceKm: number | null;
	urgencyFeeId?: string | null;
	minimumCharge?: number;
	// Distance breakdown for storage
	distanceMode?: 'warehouse' | 'zone' | 'fallback';
	warehouseToPickupKm?: number;
	pickupToDeliveryKm?: number;
	// Type-based pricing fields (optional)
	serviceTypeId?: string | null;
	hasTimePreference?: boolean;
	isOutOfZone?: boolean;
	tolls?: number;
}

export interface CourierPricingSettings {
	pricingMode: 'warehouse' | 'zone' | 'type';
	warehouseCoords: [number, number] | null;
	showPriceToCourier: boolean;
	showPriceToClient: boolean;
	defaultUrgencyFeeId: string | null;
	minimumCharge: number;
	roundDistance: boolean;
	vatEnabled: boolean;
	vatRate: number | null;
	pricesIncludeVat: boolean;
}

export interface VatBreakdown {
	net: number;
	vat: number;
	gross: number;
	rate: number;
}

/**
 * Calculate VAT breakdown for a price.
 * Pure function — no DB access. Called at display/export time.
 */
export function calculateVat(
	price: number,
	vatRate: number,
	priceIncludesVat: boolean
): VatBreakdown {
	if (vatRate <= 0) {
		return { net: price, vat: 0, gross: price, rate: 0 };
	}

	const rate = vatRate / 100;

	if (priceIncludesVat) {
		const net = Math.round((price / (1 + rate)) * 100) / 100;
		const vat = Math.round((price - net) * 100) / 100;
		return { net, vat, gross: price, rate: vatRate };
	} else {
		const vat = Math.round((price * rate) * 100) / 100;
		const gross = Math.round((price + vat) * 100) / 100;
		return { net: price, vat, gross, rate: vatRate };
	}
}

export interface CalculatePriceResult {
	success: boolean;
	price: number | null;
	breakdown: PriceBreakdown | null;
	error?: string;
}

/**
 * Get all courier pricing settings
 */
export async function getCourierPricingSettings(
	supabase: SupabaseClient
): Promise<CourierPricingSettings> {
	// Fetch non-sensitive settings from the public view and warehouse coords
	// from a SECURITY DEFINER RPC (warehouse coords are excluded from the view
	// for privacy — they may reveal the courier's home address).
	const [{ data: profile }, { data: warehouseRows }] = await Promise.all([
		supabase
			.from('courier_public_profile')
			.select(
				'pricing_mode, show_price_to_courier, show_price_to_client, default_urgency_fee_id, minimum_charge, round_distance, vat_enabled, vat_rate, prices_include_vat'
			)
			.single(),
		supabase.rpc('get_courier_warehouse_coords')
	]);

	const wh = warehouseRows?.[0] ?? null;

	return {
		pricingMode: (profile?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'zone',
		warehouseCoords:
			wh?.warehouse_lat && wh?.warehouse_lng
				? [wh.warehouse_lng, wh.warehouse_lat]
				: null,
		showPriceToCourier: profile?.show_price_to_courier ?? true,
		showPriceToClient: profile?.show_price_to_client ?? true,
		defaultUrgencyFeeId: profile?.default_urgency_fee_id || null,
		minimumCharge: profile?.minimum_charge || 0,
		roundDistance: profile?.round_distance ?? false,
		vatEnabled: profile?.vat_enabled ?? false,
		vatRate: profile?.vat_rate ?? null,
		pricesIncludeVat: profile?.prices_include_vat ?? false
	};
}

/**
 * Get client's pricing configuration
 */
export async function getClientPricing(
	supabase: SupabaseClient,
	clientId: string
): Promise<{ config: PricingConfig | null; zones: PricingZone[] }> {
	// Get pricing config
	const { data: config } = await supabase
		.from('client_pricing')
		.select('*')
		.eq('client_id', clientId)
		.single();

	// Get zones if zone-based pricing
	let zones: PricingZone[] = [];
	if (config?.pricing_model === 'zone') {
		const { data: zoneData } = await supabase
			.from('pricing_zones')
			.select('*')
			.eq('client_id', clientId)
			.order('min_km');

		zones = (zoneData || []) as PricingZone[];
	}

	return {
		config: config as PricingConfig | null,
		zones
	};
}

/**
 * Get urgency fee by ID
 */
export async function getUrgencyFee(
	supabase: SupabaseClient,
	urgencyFeeId: string
): Promise<UrgencyFee | null> {
	const { data } = await supabase
		.from('urgency_fees')
		.select('*')
		.eq('id', urgencyFeeId)
		.eq('active', true)
		.single();

	return data as UrgencyFee | null;
}

/**
 * Calculate distance from zone based on distance
 */
function getZonePrice(zones: PricingZone[], distanceKm: number): number | null {
	for (const zone of zones) {
		const minOk = distanceKm >= zone.min_km;
		const maxOk = zone.max_km === null || distanceKm < zone.max_km;

		if (minOk && maxOk) {
			return zone.price;
		}
	}

	// No matching zone found
	return null;
}

/**
 * Calculate price based on pricing model
 */
function calculateBasePrice(
	config: PricingConfig,
	zones: PricingZone[],
	distanceKm: number
): { price: number; model: 'per_km' | 'zone' | 'flat_plus_km' } | null {
	switch (config.pricing_model) {
		// Both per_km and flat_plus_km use the same calculation: base + (distance * rate)
		// The distinction is semantic: per_km emphasizes distance-based pricing,
		// while flat_plus_km emphasizes a flat base fee plus distance surcharge
		case 'per_km':
		case 'flat_plus_km':
			return {
				price: config.base_fee + distanceKm * config.per_km_rate,
				model: config.pricing_model
			};

		case 'zone': {
			const zonePrice = getZonePrice(zones, distanceKm);
			if (zonePrice === null) {
				return null; // No matching zone
			}
			return {
				price: zonePrice,
				model: 'zone'
			};
		}

		default:
			return null;
	}
}

/**
 * Apply urgency fee to a base price
 */
function applyUrgencyFee(basePrice: number, urgencyFee: UrgencyFee): number {
	return basePrice * urgencyFee.multiplier + urgencyFee.flat_fee;
}

/**
 * Calculate the full price for a service
 */
export async function calculateServicePrice(
	supabase: SupabaseClient,
	input: ServicePricingInput
): Promise<CalculatePriceResult> {
	try {
		// Get courier's pricing mode
		const { data: courier } = await supabase
			.from('courier_public_profile')
			.select('pricing_mode')
			.single();

		// If type-based pricing mode, delegate to type pricing service
		if (courier?.pricing_mode === 'type') {
			// Type-based pricing requires a service type
			if (!input.serviceTypeId) {
				return {
					success: false,
					price: null,
					breakdown: null,
					error: 'Service type required for type-based pricing'
				};
			}

			const typedInput: TypePricingInput = {
				serviceTypeId: input.serviceTypeId,
				hasTimePreference: input.hasTimePreference || false,
				isOutOfZone: input.isOutOfZone || false,
				distanceKm: input.distanceKm,
				tolls: input.tolls ?? null
			};

			const result = await calculateTypedPrice(supabase, typedInput);

			if (result.success && result.breakdown) {
				// Apply minimum charge (same as distance-based branch)
				const minimumCharge = input.minimumCharge || 0;
				const adjustedPrice = Math.max(result.price ?? 0, minimumCharge);

				// Map type-based breakdown to standard PriceBreakdown format
				const breakdown: PriceBreakdown = {
					base: result.breakdown.base,
					distance: result.breakdown.distance,
					urgency: 0, // Type-based pricing doesn't use urgency fees
					total: adjustedPrice,
					model: 'type',
					distance_km: input.distanceKm ?? 0,
					// Include distance breakdown if provided
					distance_mode: input.distanceMode,
					warehouse_to_pickup_km: input.warehouseToPickupKm,
					pickup_to_delivery_km: input.pickupToDeliveryKm,
					// Type-based pricing specific fields
					tolls: result.breakdown.tolls,
					reason: result.breakdown.reason,
					service_type_name: result.breakdown.serviceTypeName
				};

				return {
					success: true,
					price: Math.round(adjustedPrice * 100) / 100,
					breakdown
				};
			}

			return {
				success: false,
				price: null,
				breakdown: null,
				error: result.error
			};
		}

		// Continue with existing distance-based pricing...

		// Validate distance
		if (input.distanceKm === null || input.distanceKm === undefined) {
			return {
				success: false,
				price: null,
				breakdown: null,
				error: 'Distance not available'
			};
		}

		// Get client pricing configuration
		const { config, zones } = await getClientPricing(supabase, input.clientId);

		if (!config) {
			return {
				success: false,
				price: null,
				breakdown: null,
				error: 'No pricing configuration for this client'
			};
		}

		// Calculate base price
		const baseResult = calculateBasePrice(config, zones, input.distanceKm);

		if (!baseResult) {
			return {
				success: false,
				price: null,
				breakdown: null,
				error: 'Unable to calculate price (no matching zone)'
			};
		}

		let finalPrice = baseResult.price;
		let urgencyAmount = 0;

		// Apply urgency fee if provided
		if (input.urgencyFeeId) {
			const urgencyFee = await getUrgencyFee(supabase, input.urgencyFeeId);
			if (urgencyFee) {
				const priceWithUrgency = applyUrgencyFee(baseResult.price, urgencyFee);
				urgencyAmount = priceWithUrgency - baseResult.price;
				finalPrice = priceWithUrgency;
			}
		}

		// Apply minimum charge if provided
		const minimumCharge = input.minimumCharge || 0;
		const priceAfterMinimum = Math.max(finalPrice, minimumCharge);

		// Build breakdown
		const breakdown: PriceBreakdown = {
			base: config.base_fee,
			distance:
				baseResult.model === 'zone' ? baseResult.price : input.distanceKm * config.per_km_rate,
			urgency: urgencyAmount,
			total: priceAfterMinimum,
			model: baseResult.model,
			distance_km: input.distanceKm,
			// Include distance breakdown if provided
			distance_mode: input.distanceMode,
			warehouse_to_pickup_km: input.warehouseToPickupKm,
			pickup_to_delivery_km: input.pickupToDeliveryKm
		};

		return {
			success: true,
			price: Math.round(priceAfterMinimum * 100) / 100, // Round to 2 decimal places
			breakdown
		};
	} catch (error) {
		return {
			success: false,
			price: null,
			breakdown: null,
			error: (error as Error).message
		};
	}
}

/**
 * Calculate and update price for a service in the database
 */
export async function calculateAndSaveServicePrice(
	supabase: SupabaseClient,
	serviceId: string,
	input: ServicePricingInput
): Promise<CalculatePriceResult> {
	const result = await calculateServicePrice(supabase, input);

	if (result.success && result.price !== null) {
		await supabase
			.from('services')
			.update({
				calculated_price: result.price,
				price_breakdown: result.breakdown
			})
			.eq('id', serviceId);
	}

	return result;
}

/**
 * Estimate price without saving (for preview purposes)
 */
export async function estimateServicePrice(
	supabase: SupabaseClient,
	clientId: string,
	distanceKm: number,
	urgencyFeeId?: string | null
): Promise<CalculatePriceResult> {
	return calculateServicePrice(supabase, {
		clientId,
		distanceKm,
		urgencyFeeId
	});
}
