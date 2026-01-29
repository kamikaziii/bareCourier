/**
 * Type-Based Pricing Service
 *
 * Calculates service prices based on service type, time preferences, and geographic zones.
 * Used when courier's pricing_mode is 'type'.
 *
 * Pricing Rules:
 * 1. Out-of-zone (highest priority): base + (km * per_km) + tolls
 * 2. Time preference: fixed time-specific price
 * 3. Normal in-zone: service type price
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceType, DistributionZone } from '$lib/database.types';

// ─── Interfaces ─────────────────────────────────────────────────────────────

/**
 * Courier's type-based pricing settings from profiles table
 */
export interface TypePricingSettings {
	timeSpecificPrice: number;
	outOfZoneBase: number;
	outOfZonePerKm: number;
}

/**
 * Input parameters for type-based price calculation
 */
export interface TypePricingInput {
	serviceTypeId: string;
	hasTimePreference: boolean;
	isOutOfZone: boolean;
	distanceKm: number | null;
	tolls: number | null;
}

/**
 * Detailed breakdown of a type-based price calculation
 */
export interface TypePriceBreakdown {
	base: number;
	distance: number;
	tolls: number;
	total: number;
	reason: 'out_of_zone' | 'time_preference' | 'service_type';
	serviceTypeName: string;
}

/**
 * Result of a type-based price calculation
 */
export interface TypePriceResult {
	success: boolean;
	price: number | null;
	breakdown: TypePriceBreakdown | null;
	error?: string;
}

// ─── Data Access Functions ──────────────────────────────────────────────────

/**
 * Get courier's type-based pricing settings from the profiles table.
 * Returns default values if settings are not configured.
 */
export async function getTypePricingSettings(
	supabase: SupabaseClient
): Promise<TypePricingSettings> {
	const { data: profile } = await supabase
		.from('profiles')
		.select('time_specific_price, out_of_zone_base, out_of_zone_per_km')
		.eq('role', 'courier')
		.limit(1)
		.single();

	return {
		timeSpecificPrice: profile?.time_specific_price ?? 0,
		outOfZoneBase: profile?.out_of_zone_base ?? 0,
		outOfZonePerKm: profile?.out_of_zone_per_km ?? 0
	};
}

/**
 * Get all active service types ordered by sort_order
 */
export async function getServiceTypes(supabase: SupabaseClient): Promise<ServiceType[]> {
	const { data, error } = await supabase
		.from('service_types')
		.select('*')
		.eq('active', true)
		.order('sort_order', { ascending: true });

	if (error) {
		console.error('Error fetching service types:', error);
		return [];
	}

	return (data as ServiceType[]) || [];
}

/**
 * Get a single service type by ID
 */
export async function getServiceType(
	supabase: SupabaseClient,
	typeId: string
): Promise<ServiceType | null> {
	const { data, error } = await supabase
		.from('service_types')
		.select('*')
		.eq('id', typeId)
		.single();

	if (error) {
		console.error('Error fetching service type:', error);
		return null;
	}

	return data as ServiceType | null;
}

/**
 * Get all distribution zones (municipalities in the service area)
 */
export async function getDistributionZones(supabase: SupabaseClient): Promise<DistributionZone[]> {
	const { data, error } = await supabase
		.from('distribution_zones')
		.select('*')
		.order('distrito', { ascending: true })
		.order('concelho', { ascending: true });

	if (error) {
		console.error('Error fetching distribution zones:', error);
		return [];
	}

	return (data as DistributionZone[]) || [];
}

/**
 * Check if a municipality (concelho) is within the courier's distribution zone.
 * Performs case-insensitive matching with trimmed whitespace.
 *
 * @param supabase - Supabase client
 * @param municipality - The municipality name to check (concelho)
 * @returns true if the municipality is in the distribution zone, false otherwise
 */
export async function isInDistributionZone(
	supabase: SupabaseClient,
	municipality: string
): Promise<boolean> {
	if (!municipality || !municipality.trim()) {
		return false;
	}

	// Use ilike for case-insensitive matching
	const { data, error } = await supabase
		.from('distribution_zones')
		.select('id')
		.ilike('concelho', municipality.trim())
		.limit(1);

	if (error) {
		console.error('Error checking distribution zone:', error);
		return false;
	}

	return (data?.length ?? 0) > 0;
}

// ─── Price Calculation ──────────────────────────────────────────────────────

/**
 * Calculate price for a service using type-based pricing rules.
 *
 * Priority order:
 * 1. Out-of-zone: base + (km * per_km) + tolls (takes precedence)
 * 2. Time preference: fixed time-specific price
 * 3. Normal in-zone: service type price
 *
 * @param supabase - Supabase client
 * @param input - Pricing calculation input parameters
 * @returns Price calculation result with breakdown
 */
export async function calculateTypedPrice(
	supabase: SupabaseClient,
	input: TypePricingInput
): Promise<TypePriceResult> {
	try {
		// Get the service type first - we need it for all pricing scenarios
		const serviceType = await getServiceType(supabase, input.serviceTypeId);

		if (!serviceType) {
			return {
				success: false,
				price: null,
				breakdown: null,
				error: 'Service type not found'
			};
		}

		const serviceTypeName = serviceType.name;

		// Get courier's type pricing settings
		const settings = await getTypePricingSettings(supabase);

		// Case 1: Out-of-zone pricing (highest priority)
		if (input.isOutOfZone) {
			// For out-of-zone, we need distance
			if (input.distanceKm === null || input.distanceKm === undefined) {
				return {
					success: false,
					price: null,
					breakdown: null,
					error: 'Distance required for out-of-zone pricing'
				};
			}

			const base = settings.outOfZoneBase;
			const distance = input.distanceKm * settings.outOfZonePerKm;
			const tolls = input.tolls ?? 0;
			const total = base + distance + tolls;

			const breakdown: TypePriceBreakdown = {
				base,
				distance,
				tolls,
				total: Math.round(total * 100) / 100,
				reason: 'out_of_zone',
				serviceTypeName
			};

			return {
				success: true,
				price: breakdown.total,
				breakdown
			};
		}

		// Case 2: Time preference pricing
		if (input.hasTimePreference && settings.timeSpecificPrice > 0) {
			const total = settings.timeSpecificPrice;

			const breakdown: TypePriceBreakdown = {
				base: total,
				distance: 0,
				tolls: 0,
				total,
				reason: 'time_preference',
				serviceTypeName
			};

			return {
				success: true,
				price: breakdown.total,
				breakdown
			};
		}

		// Case 3: Normal service type pricing (in-zone, no time preference)
		const total = serviceType.price;

		const breakdown: TypePriceBreakdown = {
			base: total,
			distance: 0,
			tolls: 0,
			total,
			reason: 'service_type',
			serviceTypeName
		};

		return {
			success: true,
			price: breakdown.total,
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
 * Detect if a delivery location is out of the distribution zone based on municipality.
 * This is a helper that combines municipality detection with zone checking.
 *
 * @param supabase - Supabase client
 * @param detectedMunicipality - The municipality detected from the delivery address
 * @returns true if out of zone, false if in zone, null if unable to determine
 */
export async function detectOutOfZone(
	supabase: SupabaseClient,
	detectedMunicipality: string | null
): Promise<boolean | null> {
	if (!detectedMunicipality) {
		// Cannot determine zone without municipality
		return null;
	}

	const inZone = await isInDistributionZone(supabase, detectedMunicipality);
	return !inZone;
}

/**
 * Get the default service type ID for new services.
 * Returns the first active service type by sort order, or null if none exist.
 */
export async function getDefaultServiceTypeId(supabase: SupabaseClient): Promise<string | null> {
	const { data } = await supabase
		.from('profiles')
		.select('default_service_type_id')
		.eq('role', 'courier')
		.limit(1)
		.single();

	// If courier has a default set, use that
	if (data?.default_service_type_id) {
		return data.default_service_type_id;
	}

	// Otherwise, get the first active service type
	const types = await getServiceTypes(supabase);
	return types.length > 0 ? types[0].id : null;
}

/**
 * Get the client's default service type ID.
 * Falls back to courier's default or first service type if not set.
 */
export async function getClientDefaultServiceTypeId(
	supabase: SupabaseClient,
	clientId: string
): Promise<string | null> {
	const { data } = await supabase
		.from('profiles')
		.select('default_service_type_id')
		.eq('id', clientId)
		.single();

	// If client has a default set, use that
	if (data?.default_service_type_id) {
		return data.default_service_type_id;
	}

	// Fall back to courier's default
	return getDefaultServiceTypeId(supabase);
}
