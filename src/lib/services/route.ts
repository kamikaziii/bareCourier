/**
 * Shared route calculation utility
 * Extracts the common distance + geometry calculation pattern
 * used across courier services, edit, and client new pages.
 */

import {
	calculateRoute,
	calculateHaversineDistance,
	calculateServiceDistance,
	estimateDrivingMinutes,
	type ServiceDistanceResult
} from '$lib/services/distance.js';
import type { CourierPricingSettings } from '$lib/services/pricing.js';

export interface RouteCalculationResult {
	distanceKm: number | null;
	durationMinutes: number | null;
	routeGeometry: string | null;
	distanceResult: ServiceDistanceResult | null;
	/** Indicates the source of the distance calculation: 'api' for OpenRouteService, 'haversine' for fallback */
	source: 'api' | 'haversine' | null;
}

const EMPTY_RESULT: RouteCalculationResult = {
	distanceKm: null,
	durationMinutes: null,
	routeGeometry: null,
	distanceResult: null,
	source: null
};

/**
 * Calculate route distance and geometry when both pickup and delivery coords are available.
 * Supports warehouse-mode pricing via courierSettings, with haversine fallback on error.
 *
 * @param pickupCoords - Pickup [lng, lat] or null
 * @param deliveryCoords - Delivery [lng, lat] or null
 * @param courierSettings - Optional courier pricing settings (enables warehouse mode)
 * @returns Distance, geometry, and optional warehouse breakdown
 */
export async function calculateRouteIfReady(
	pickupCoords: [number, number] | null,
	deliveryCoords: [number, number] | null,
	courierSettings?: CourierPricingSettings | null
): Promise<RouteCalculationResult> {
	if (!pickupCoords || !deliveryCoords) {
		return EMPTY_RESULT;
	}

	let distanceKm: number | null = null;
	let durationMinutes: number | null = null;
	let distanceResult: ServiceDistanceResult | null = null;
	let source: 'api' | 'haversine' = 'api';

	try {
		let routeGeometry: string | null = null;

		if (courierSettings) {
			const result = await calculateServiceDistance({
				pickupCoords,
				deliveryCoords,
				warehouseCoords: courierSettings.warehouseCoords,
				pricingMode: courierSettings.pricingMode,
				roundDistance: courierSettings.roundDistance
			});
			distanceResult = result;
			distanceKm = result.totalDistanceKm;
			durationMinutes = result.durationMinutes ?? null;
			routeGeometry = result.geometry || null;
			// Use the source from calculateServiceDistance which tracks if ANY leg used haversine
			source = result.source;
		} else {
			const result = await calculateRoute(pickupCoords, deliveryCoords);
			if (result) {
				distanceKm = result.distanceKm;
				durationMinutes = result.durationMinutes;
				routeGeometry = result.geometry || null;
				source = 'api';
			} else {
				distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
				durationMinutes = estimateDrivingMinutes(distanceKm);
				source = 'haversine';
			}
		}

		return { distanceKm, durationMinutes, routeGeometry, distanceResult, source };
	} catch {
		// Haversine fallback
		distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
		durationMinutes = estimateDrivingMinutes(distanceKm);
		return { distanceKm, durationMinutes, routeGeometry: null, distanceResult: null, source: 'haversine' };
	}
}
