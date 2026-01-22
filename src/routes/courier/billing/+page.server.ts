import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Profile, ClientPricing, UrgencyFee } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load all clients with their pricing configuration
	const { data: clients } = await supabase
		.from('profiles')
		.select('id, name, phone, active')
		.eq('role', 'client')
		.order('name');

	// Load all client pricing configurations
	const { data: pricingConfigs } = await supabase
		.from('client_pricing')
		.select('*');

	// Load urgency fees for reference
	const { data: urgencyFees } = await supabase
		.from('urgency_fees')
		.select('*')
		.eq('active', true)
		.order('sort_order');

	return {
		clients: (clients || []) as Pick<Profile, 'id' | 'name' | 'phone' | 'active'>[],
		pricingConfigs: (pricingConfigs || []) as ClientPricing[],
		urgencyFees: (urgencyFees || []) as UrgencyFee[]
	};
};
