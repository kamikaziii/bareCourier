/**
 * OpenRouteService Distance Calculation
 * Uses OpenRouteService Directions API for distance calculation
 * Free tier: 2,000 requests/day
 */

import { PUBLIC_OPENROUTESERVICE_KEY } from '$env/static/public';

export interface RouteResponse {
	distance: number; // meters
	duration: number; // seconds
	geometry: string; // Encoded polyline
}

export interface RouteResult {
	distanceKm: number;
	durationMinutes: number;
	geometry?: string;
}

const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';

/**
 * Calculate distance and duration between two points
 * @param start - Start coordinates [lng, lat]
 * @param end - End coordinates [lng, lat]
 * @returns Route information or null if calculation failed
 */
export async function calculateRoute(
	start: [number, number],
	end: [number, number]
): Promise<RouteResult | null> {
	if (!PUBLIC_OPENROUTESERVICE_KEY) {
		console.warn('OpenRouteService key not configured');
		return null;
	}

	try {
		const response = await fetch(ORS_DIRECTIONS_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: PUBLIC_OPENROUTESERVICE_KEY
			},
			body: JSON.stringify({
				coordinates: [start, end]
			})
		});

		if (!response.ok) {
			throw new Error(`Route calculation failed: ${response.status}`);
		}

		const data = await response.json();

		if (data.routes && data.routes.length > 0) {
			const route = data.routes[0];
			return {
				distanceKm: Math.round((route.summary.distance / 1000) * 10) / 10, // Round to 1 decimal
				durationMinutes: Math.round(route.summary.duration / 60),
				geometry: route.geometry
			};
		}

		return null;
	} catch (error) {
		console.error('Route calculation error:', error);
		return null;
	}
}

/**
 * Calculate distance between two coordinates using Haversine formula (fallback)
 * @param start - Start coordinates [lng, lat]
 * @param end - End coordinates [lng, lat]
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
	start: [number, number],
	end: [number, number]
): number {
	const [lng1, lat1] = start;
	const [lng2, lat2] = end;

	const R = 6371; // Earth's radius in km
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return Math.round(R * c * 10) / 10; // Round to 1 decimal
}

function toRad(deg: number): number {
	return deg * (Math.PI / 180);
}

/**
 * Decode a polyline string into coordinates
 * @param encoded - Encoded polyline string
 * @returns Array of [lng, lat] coordinates
 */
export function decodePolyline(encoded: string): [number, number][] {
	const points: [number, number][] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;

	while (index < encoded.length) {
		let shift = 0;
		let result = 0;
		let byte;

		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);

		const dlat = result & 1 ? ~(result >> 1) : result >> 1;
		lat += dlat;

		shift = 0;
		result = 0;

		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);

		const dlng = result & 1 ? ~(result >> 1) : result >> 1;
		lng += dlng;

		// OpenRouteService uses precision 5
		points.push([lng / 1e5, lat / 1e5]);
	}

	return points;
}
