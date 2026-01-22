/**
 * Mapbox Geocoding Service
 * Uses Mapbox Geocoding API for address autocomplete and coordinate lookup
 */

import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';

export interface GeocodingResult {
	id: string;
	place_name: string;
	center: [number, number]; // [lng, lat]
	relevance: number;
}

export interface GeocodingResponse {
	features: GeocodingResult[];
}

const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

/**
 * Search for addresses using Mapbox Geocoding API
 * @param query - The search query (partial address)
 * @param options - Optional parameters
 * @returns Array of geocoding results
 */
export async function searchAddress(
	query: string,
	options: {
		country?: string;
		limit?: number;
		proximity?: [number, number]; // [lng, lat] - bias results toward this location
	} = {}
): Promise<GeocodingResult[]> {
	if (!query.trim()) {
		return [];
	}

	if (!PUBLIC_MAPBOX_TOKEN) {
		console.warn('Mapbox token not configured');
		return [];
	}

	const { country = 'pt', limit = 5, proximity } = options;

	const params = new URLSearchParams({
		access_token: PUBLIC_MAPBOX_TOKEN,
		country,
		limit: limit.toString(),
		types: 'address,place', // POI removed - no longer supported in Mapbox Geocoding v5/v6
		language: 'pt'
	});

	if (proximity) {
		params.set('proximity', proximity.join(','));
	}

	const encodedQuery = encodeURIComponent(query);
	const url = `${MAPBOX_GEOCODING_URL}/${encodedQuery}.json?${params}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Geocoding failed: ${response.status}`);
		}

		const data: GeocodingResponse = await response.json();
		return data.features;
	} catch (error) {
		console.error('Geocoding error:', error);
		return [];
	}
}

/**
 * Get coordinates for a specific address
 * @param address - The full address to geocode
 * @returns Coordinates [lng, lat] or null if not found
 */
export async function getCoordinates(address: string): Promise<[number, number] | null> {
	const results = await searchAddress(address, { limit: 1 });
	if (results.length > 0) {
		return results[0].center;
	}
	return null;
}

/**
 * Reverse geocode coordinates to get an address
 * @param lng - Longitude
 * @param lat - Latitude
 * @returns Address string or null if not found
 */
export async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
	if (!PUBLIC_MAPBOX_TOKEN) {
		console.warn('Mapbox token not configured');
		return null;
	}

	const params = new URLSearchParams({
		access_token: PUBLIC_MAPBOX_TOKEN,
		types: 'address',
		language: 'pt'
	});

	const url = `${MAPBOX_GEOCODING_URL}/${lng},${lat}.json?${params}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Reverse geocoding failed: ${response.status}`);
		}

		const data: GeocodingResponse = await response.json();
		if (data.features.length > 0) {
			return data.features[0].place_name;
		}
		return null;
	} catch (error) {
		console.error('Reverse geocoding error:', error);
		return null;
	}
}
