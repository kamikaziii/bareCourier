/**
 * Shared zone detection utility
 * Uses reverse geocoding (primary) with string-parsing fallback to detect
 * whether an address is inside a distribution zone.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { reverseGeocode } from './geocoding.js';
import { extractMunicipalityFromAddress } from './municipality.js';
import { isInDistributionZone } from './type-pricing.js';

export interface ZoneDetectionResult {
	municipality: string | null;
	isOutOfZone: boolean | null;
}

/**
 * Detect whether an address is inside a distribution zone.
 * Primary: reverse geocode coords to get the concelho from structured v6 context.
 * Fallback: parse the address string if reverse geocoding fails or no coords provided.
 */
export async function detectZone(
	supabase: SupabaseClient,
	address: string,
	coords: [number, number] | null
): Promise<ZoneDetectionResult> {
	let municipality: string | null = null;

	// Primary: reverse geocode for structured municipality extraction
	if (coords) {
		try {
			const result = await reverseGeocode(coords[0], coords[1]);
			municipality = result.municipality;
		} catch (err) {
			console.warn('Reverse geocode failed, falling back to string parsing:', err);
		}
	}

	// Fallback: parse municipality from address string
	if (!municipality && address) {
		municipality = extractMunicipalityFromAddress(address);
	}

	if (!municipality) {
		return { municipality: null, isOutOfZone: null };
	}

	const inZone = await isInDistributionZone(supabase, municipality);
	return { municipality, isOutOfZone: !inZone };
}
