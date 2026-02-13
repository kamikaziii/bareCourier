import type { PageLoad } from './$types';
import type { ServiceType } from '$lib/database.types.js';
import type { AddressSuggestion } from '$lib/types/address-suggestion.js';

function truncateLabel(address: string, maxLength = 30): string {
	return address.length > maxLength ? address.slice(0, maxLength) + '…' : address;
}

function buildSuggestions(
	rows: { location: string; lat: number | null; lng: number | null; count: number }[],
	defaultAddress?: { address: string; coords: [number, number] | null } | null
): AddressSuggestion[] {
	const seen = new Set<string>();
	const suggestions: AddressSuggestion[] = [];

	// Default address first (if provided)
	if (defaultAddress?.address) {
		seen.add(defaultAddress.address);
		suggestions.push({
			label: truncateLabel(defaultAddress.address),
			address: defaultAddress.address,
			coords: defaultAddress.coords,
			isDefault: true
		});
	}

	// Then by frequency (rows are pre-sorted by count DESC, then recency DESC)
	for (const row of rows) {
		if (seen.has(row.location)) continue;
		if (suggestions.length >= 3) break;
		seen.add(row.location);
		suggestions.push({
			label: truncateLabel(row.location),
			address: row.location,
			coords: row.lat != null && row.lng != null ? [row.lng, row.lat] : null
		});
	}

	return suggestions;
}

export const load: PageLoad = async ({ parent }) => {
	const { supabase, profile } = await parent();

	// Get courier's pricing mode, type-based settings, and price visibility
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('pricing_mode, time_specific_price, out_of_zone_base, out_of_zone_per_km, show_price_to_client')
		.eq('role', 'courier')
		.limit(1)
		.single();

	const pricingMode = (courierProfile?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse';
	const showPriceToClient = courierProfile?.show_price_to_client ?? true;

	// Type pricing settings (only relevant for type mode)
	const typePricingSettings = {
		timeSpecificPrice: courierProfile?.time_specific_price ?? 13,
		outOfZoneBase: courierProfile?.out_of_zone_base ?? 13,
		outOfZonePerKm: courierProfile?.out_of_zone_per_km ?? 0.5
	};

	// Get client's default service type if in type-based pricing mode
	let clientServiceType: ServiceType | null = null;
	if (pricingMode === 'type' && profile?.id) {
		// First get the client's default service type ID
		const { data: clientProfile } = await supabase
			.from('profiles')
			.select('default_service_type_id')
			.eq('id', profile.id)
			.single();

		if (clientProfile?.default_service_type_id) {
			// Then get the service type details
			const { data: serviceType } = await supabase
				.from('service_types')
				.select('*')
				.eq('id', clientProfile.default_service_type_id)
				.single();

			clientServiceType = serviceType as ServiceType | null;
		}
	}

	// Fetch client's past service addresses for suggestion chips
	let pickupSuggestions: AddressSuggestion[] = [];
	let deliverySuggestions: AddressSuggestion[] = [];

	if (profile?.id) {
		// Query distinct pickup/delivery locations with frequency count
		// Aggregating client-side since a solo courier's client won't have thousands of services
		const { data: pastServices } = await supabase
			.from('services')
			.select('pickup_location, pickup_lat, pickup_lng, delivery_location, delivery_lat, delivery_lng')
			.eq('client_id', profile.id)
			.is('deleted_at', null)
			.order('created_at', { ascending: false })
			.limit(50);

		if (pastServices && pastServices.length > 0) {
			// Build pickup frequency map
			const pickupMap = new Map<string, { lat: number | null; lng: number | null; count: number; lastIndex: number }>();
			pastServices.forEach((s, i) => {
				if (!s.pickup_location) return;
				const existing = pickupMap.get(s.pickup_location);
				if (existing) {
					existing.count++;
				} else {
					pickupMap.set(s.pickup_location, { lat: s.pickup_lat, lng: s.pickup_lng, count: 1, lastIndex: i });
				}
			});

			const pickupRows = [...pickupMap.entries()]
				.map(([location, data]) => ({ location, ...data }))
				.sort((a, b) => b.count - a.count || a.lastIndex - b.lastIndex);

			// Build delivery frequency map
			const deliveryMap = new Map<string, { lat: number | null; lng: number | null; count: number; lastIndex: number }>();
			pastServices.forEach((s, i) => {
				if (!s.delivery_location) return;
				const existing = deliveryMap.get(s.delivery_location);
				if (existing) {
					existing.count++;
				} else {
					deliveryMap.set(s.delivery_location, { lat: s.delivery_lat, lng: s.delivery_lng, count: 1, lastIndex: i });
				}
			});

			const deliveryRows = [...deliveryMap.entries()]
				.map(([location, data]) => ({ location, ...data }))
				.sort((a, b) => b.count - a.count || a.lastIndex - b.lastIndex);

			// Build suggestions
			const defaultPickupAddress = profile.default_pickup_location
				? {
						address: profile.default_pickup_location,
						coords: (profile.default_pickup_lng != null && profile.default_pickup_lat != null
							? [profile.default_pickup_lng, profile.default_pickup_lat]
							: null) as [number, number] | null
					}
				: null;

			pickupSuggestions = buildSuggestions(pickupRows, defaultPickupAddress);
			deliverySuggestions = buildSuggestions(deliveryRows);
		} else if (profile.default_pickup_location) {
			// No past services but has default address — show it as a chip
			pickupSuggestions = [{
				label: truncateLabel(profile.default_pickup_location),
				address: profile.default_pickup_location,
				coords: (profile.default_pickup_lng != null && profile.default_pickup_lat != null
					? [profile.default_pickup_lng, profile.default_pickup_lat]
					: null) as [number, number] | null,
				isDefault: true
			}];
		}
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
