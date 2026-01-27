/**
 * Shared route calculation utility
 * Extracts the common distance + geometry calculation pattern
 * used across courier services, edit, and client new pages.
 */

import {
	calculateRoute,
	calculateHaversineDistance,
	calculateServiceDistance,
	type ServiceDistanceResult
} from '$lib/services/distance.js';
import type { CourierPricingSettings } from '$lib/services/pricing.js';

export interface RouteCalculationResult {
	distanceKm: number | null;
	routeGeometry: string | null;
	distanceResult: ServiceDistanceResult | null;
}

const EMPTY_RESULT: RouteCalculationResult = {
	distanceKm: null,
	routeGeometry: null,
	distanceResult: null
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
	let distanceResult: ServiceDistanceResult | null = null;

	try {
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
		} else {
			const result = await calculateRoute(pickupCoords, deliveryCoords);
			if (result) {
				distanceKm = result.distanceKm;
			} else {
				distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
			}
		}

		// Get route geometry for map display
		const routeResult = await calculateRoute(pickupCoords, deliveryCoords);
		const routeGeometry = routeResult?.geometry || null;

		return { distanceKm, routeGeometry, distanceResult };
	} catch {
		// Haversine fallback
		distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
		return { distanceKm, routeGeometry: null, distanceResult: null };
	}
}
