import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { ClientPricing, PricingZone } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load client's pricing configuration
	const { data: pricing } = await supabase
		.from('client_pricing')
		.select('*')
		.eq('client_id', user.id)
		.single();

	// Load pricing zones if zone pricing model
	const { data: zones } = await supabase
		.from('pricing_zones')
		.select('*')
		.eq('client_id', user.id)
		.order('min_km');

	return {
		pricing: pricing as ClientPricing | null,
		zones: (zones || []) as PricingZone[]
	};
};
