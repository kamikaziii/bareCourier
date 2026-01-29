import type { PageLoad } from './$types';
import type { ServiceType } from '$lib/database.types.js';

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

	return {
		pricingMode,
		typePricingSettings,
		showPriceToClient,
		clientServiceType
	};
};
