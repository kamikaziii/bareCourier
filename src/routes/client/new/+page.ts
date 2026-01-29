import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase } = await parent();

	// Get courier's pricing mode and type-based settings
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('pricing_mode, time_specific_price, out_of_zone_base, out_of_zone_per_km')
		.eq('role', 'courier')
		.limit(1)
		.single();

	const pricingMode = (courierProfile?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse';

	// Type pricing settings (only relevant for type mode)
	const typePricingSettings = {
		timeSpecificPrice: courierProfile?.time_specific_price ?? 13,
		outOfZoneBase: courierProfile?.out_of_zone_base ?? 13,
		outOfZonePerKm: courierProfile?.out_of_zone_per_km ?? 0.5
	};

	return {
		pricingMode,
		typePricingSettings
	};
};
