/**
 * Mapbox Geocoding Service
 * Uses Mapbox Geocoding API v6 for address autocomplete, coordinate lookup, and reverse geocoding
 */

import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';

// --- Public interfaces (unchanged for callers) ---

export interface GeocodingResult {
	id: string;
	place_name: string;
	center: [number, number]; // [lng, lat]
}

export interface ReverseGeocodeResult {
	municipality: string | null;
}

// --- Internal v6 types ---

interface MapboxV6Properties {
	mapbox_id: string;
	full_address?: string;
	name?: string;
	context?: {
		district?: { name: string }; // concelho in Portugal
	};
}

interface MapboxV6Feature {
	type: 'Feature';
	properties: MapboxV6Properties;
	geometry: { type: 'Point'; coordinates: [number, number] };
}

interface MapboxV6Response {
	type: 'FeatureCollection';
	features: MapboxV6Feature[];
}

const MAPBOX_V6_FORWARD_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const MAPBOX_V6_REVERSE_URL = 'https://api.mapbox.com/search/geocode/v6/reverse';

/**
 * Search for addresses using Mapbox Geocoding API v6
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
		q: query,
		access_token: PUBLIC_MAPBOX_TOKEN,
		country,
		limit: limit.toString(),
		types: 'address,place',
		language: 'pt'
	});

	if (proximity) {
		params.set('proximity', proximity.join(','));
	}

	const url = `${MAPBOX_V6_FORWARD_URL}?${params}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Geocoding failed: ${response.status}`);
		}

		const data: MapboxV6Response = await response.json();

		// Map v6 response to existing GeocodingResult format
		return data.features.map((f) => ({
			id: f.properties.mapbox_id,
			place_name: f.properties.full_address || f.properties.name || '',
			center: f.geometry.coordinates
		}));
	} catch (error) {
		console.error('Geocoding error:', error);
		return [];
	}
}

const reverseGeocodeCache = new Map<string, ReverseGeocodeResult>();

/**
 * Reverse geocode coordinates to extract municipality (concelho)
 * Uses Mapbox Geocoding API v6 reverse endpoint
 * @param lng - Longitude
 * @param lat - Latitude
 * @returns Municipality from reverse geocoding
 */
export async function reverseGeocode(lng: number, lat: number): Promise<ReverseGeocodeResult> {
	const cacheKey = `${lng.toFixed(6)},${lat.toFixed(6)}`;
	const cached = reverseGeocodeCache.get(cacheKey);
	if (cached) return cached;

	if (!PUBLIC_MAPBOX_TOKEN) {
		console.warn('Mapbox token not configured');
		return { municipality: null };
	}

	const params = new URLSearchParams({
		longitude: lng.toString(),
		latitude: lat.toString(),
		access_token: PUBLIC_MAPBOX_TOKEN,
		language: 'pt',
		types: 'address,place'
	});

	const url = `${MAPBOX_V6_REVERSE_URL}?${params}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Reverse geocoding failed: ${response.status}`);
		}

		const data: MapboxV6Response = await response.json();

		if (data.features.length === 0) {
			return { municipality: null };
		}

		const feature = data.features[0];
		const result: ReverseGeocodeResult = {
			municipality: feature.properties.context?.district?.name || null // concelho in Portugal
		};
		reverseGeocodeCache.set(cacheKey, result);
		return result;
	} catch (error) {
		console.error('Reverse geocoding error:', error);
		return { municipality: null };
	}
}
