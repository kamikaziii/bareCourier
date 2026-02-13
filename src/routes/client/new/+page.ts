import type { PageLoad } from './$types';
import type { ServiceType } from '$lib/database.types.js';
import type { AddressSuggestion } from '$lib/types/address-suggestion.js';

/** Maximum number of address suggestion chips shown (includes the default address chip) */
const MAX_SUGGESTIONS = 3;
const ADDRESS_HISTORY_SAMPLE_SIZE = 50;

function toCoordsPair(
	lng: number | null | undefined,
	lat: number | null | undefined
): [number, number] | null {
	return lng != null && lat != null ? [lng, lat] : null;
}

function rankByFrequency<T>(
	items: T[],
	getFields: (item: T) => { location: string | null; lat: number | null; lng: number | null }
): { location: string; lat: number | null; lng: number | null; count: number }[] {
	const map = new Map<string, { lat: number | null; lng: number | null; count: number; lastIndex: number }>();
	items.forEach((item, i) => {
		const { location, lat, lng } = getFields(item);
		if (!location) return;
		const existing = map.get(location);
		if (existing) {
			existing.count++;
		} else {
			map.set(location, { lat, lng, count: 1, lastIndex: i });
		}
	});
	return [...map.entries()]
		.map(([location, data]) => ({ location, ...data }))
		.sort((a, b) => b.count - a.count || a.lastIndex - b.lastIndex);
}

function buildSuggestions(
	rows: { location: string; lat: number | null; lng: number | null; count: number }[],
	defaultAddress?: { address: string; coords: [number, number] | null } | null
): AddressSuggestion[] {
	const seen = new Set<string>();
	const suggestions: AddressSuggestion[] = [];

	if (defaultAddress?.address) {
		seen.add(defaultAddress.address);
		suggestions.push({
			address: defaultAddress.address,
			coords: defaultAddress.coords,
			isDefault: true
		});
	}

	for (const row of rows) {
		if (seen.has(row.location)) continue;
		if (suggestions.length >= MAX_SUGGESTIONS) break;
		seen.add(row.location);
		suggestions.push({
			address: row.location,
			coords: toCoordsPair(row.lng, row.lat)
		});
	}

	return suggestions;
}

export const load: PageLoad = async ({ parent }) => {
	const { supabase, profile } = await parent();

	// Fire independent queries in parallel
	const [courierProfileResult, pastServicesResult] = await Promise.all([
		supabase
			.from('courier_public_profile')
			.select('pricing_mode, time_specific_price, out_of_zone_base, out_of_zone_per_km, show_price_to_client')
			.single(),
		profile?.id
			? supabase
					.from('services')
					.select('pickup_location, pickup_lat, pickup_lng, delivery_location, delivery_lat, delivery_lng')
					.eq('client_id', profile.id)
					.is('deleted_at', null)
					.order('created_at', { ascending: false })
					.limit(ADDRESS_HISTORY_SAMPLE_SIZE)
			: Promise.resolve(null)
	]);

	const courierProfile = courierProfileResult.data;
	const pastServices = pastServicesResult?.data ?? null;

	const pricingMode = (courierProfile?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse';
	const showPriceToClient = courierProfile?.show_price_to_client ?? true;

	const typePricingSettings = {
		timeSpecificPrice: courierProfile?.time_specific_price ?? 13,
		outOfZoneBase: courierProfile?.out_of_zone_base ?? 13,
		outOfZonePerKm: courierProfile?.out_of_zone_per_km ?? 0.5
	};

	// Get client's default service type if in type-based pricing mode
	let clientServiceType: ServiceType | null = null;
	if (pricingMode === 'type' && profile?.id) {
		const { data: clientProfile } = await supabase
			.from('profiles')
			.select('default_service_type_id')
			.eq('id', profile.id)
			.single();

		if (clientProfile?.default_service_type_id) {
			const { data: serviceType } = await supabase
				.from('service_types')
				.select('*')
				.eq('id', clientProfile.default_service_type_id)
				.single();

			clientServiceType = serviceType as ServiceType | null;
		}
	}

	// Build address suggestion chips
	let pickupSuggestions: AddressSuggestion[] = [];
	let deliverySuggestions: AddressSuggestion[] = [];

	if (pastServices && pastServices.length > 0) {
		const pickupRows = rankByFrequency(pastServices, (s) => ({
			location: s.pickup_location,
			lat: s.pickup_lat,
			lng: s.pickup_lng
		}));

		const deliveryRows = rankByFrequency(pastServices, (s) => ({
			location: s.delivery_location,
			lat: s.delivery_lat,
			lng: s.delivery_lng
		}));

		const defaultPickupAddress = profile?.default_pickup_location
			? {
					address: profile.default_pickup_location,
					coords: toCoordsPair(profile.default_pickup_lng, profile.default_pickup_lat)
				}
			: null;

		pickupSuggestions = buildSuggestions(pickupRows, defaultPickupAddress);
		deliverySuggestions = buildSuggestions(deliveryRows);
	} else if (profile?.default_pickup_location) {
		// No past services but has default address — show it as a chip
		pickupSuggestions = [{
			address: profile.default_pickup_location,
			coords: toCoordsPair(profile.default_pickup_lng, profile.default_pickup_lat),
			isDefault: true
		}];
	}

	return {
		pricingMode,
		typePricingSettings,
		showPriceToClient,
		clientServiceType,
		pickupSuggestions,
		deliverySuggestions
	};
};
