import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import { getServiceTypes } from '$lib/services/type-pricing.js';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Verify courier role
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('role, pricing_mode')
		.eq('id', user.id)
		.single();

	if (courierProfile?.role !== 'courier') {
		redirect(303, localizeHref('/client'));
	}

	const pricingMode = (courierProfile?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse';

	// Only load service types if in type-based pricing mode
	let serviceTypes: Awaited<ReturnType<typeof getServiceTypes>> = [];
	if (pricingMode === 'type') {
		serviceTypes = await getServiceTypes(supabase);
	}

	return {
		pricingMode,
		serviceTypes
	};
};
