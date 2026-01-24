/**
 * Pricing Service
 *
 * Calculates service prices based on:
 * - Courier's pricing_mode (warehouse vs zone-based distance calculation)
 * - Client's pricing configuration (per_km, flat_plus_km, or zone model)
 * - Urgency fees if applicable
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PriceBreakdown } from '$lib/database.types';

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
}

export interface CourierPricingSettings {
	pricingMode: 'warehouse' | 'zone';
	warehouseCoords: [number, number] | null;
	autoCalculatePrice: boolean;
	defaultUrgencyFeeId: string | null;
	minimumCharge: number;
	roundDistance: boolean;
}

export interface CalculatePriceResult {
	success: boolean;
	price: number | null;
	breakdown: PriceBreakdown | null;
	error?: string;
}

/**
 * Get the courier's pricing mode
 */
export async function getCourierPricingMode(
	supabase: SupabaseClient
): Promise<'warehouse' | 'zone'> {
	const { data: profiles } = await supabase
		.from('profiles')
		.select('pricing_mode')
		.eq('role', 'courier')
		.limit(1)
		.single();

	return (profiles?.pricing_mode as 'warehouse' | 'zone') || 'warehouse';
}

/**
 * Get all courier pricing settings
 */
export async function getCourierPricingSettings(
	supabase: SupabaseClient
): Promise<CourierPricingSettings> {
	const { data: profile } = await supabase
		.from('profiles')
		.select(
			'pricing_mode, warehouse_lat, warehouse_lng, auto_calculate_price, default_urgency_fee_id, minimum_charge, round_distance'
		)
		.eq('role', 'courier')
		.limit(1)
		.single();

	return {
		pricingMode: (profile?.pricing_mode as 'warehouse' | 'zone') || 'zone',
		warehouseCoords:
			profile?.warehouse_lat && profile?.warehouse_lng
				? [profile.warehouse_lng, profile.warehouse_lat]
				: null,
		autoCalculatePrice: profile?.auto_calculate_price ?? true,
		defaultUrgencyFeeId: profile?.default_urgency_fee_id || null,
		minimumCharge: profile?.minimum_charge || 0,
		roundDistance: profile?.round_distance ?? false
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
			distance_km: input.distanceKm
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
