import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, ClientPricing, PricingZone, UrgencyFee } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	const { client_id } = params;

	// Load client profile
	const { data: client } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', client_id)
		.eq('role', 'client')
		.single();

	if (!client) {
		error(404, 'Client not found');
	}

	// Load client's pricing configuration
	const { data: pricing } = await supabase
		.from('client_pricing')
		.select('*')
		.eq('client_id', client_id)
		.single();

	// Load pricing zones if zone pricing model
	const { data: zones } = await supabase
		.from('pricing_zones')
		.select('*')
		.eq('client_id', client_id)
		.order('min_km');

	// Load urgency fees for reference
	const { data: urgencyFees } = await supabase
		.from('urgency_fees')
		.select('*')
		.eq('active', true)
		.order('sort_order');

	return {
		client: client as Profile,
		pricing: pricing as ClientPricing | null,
		zones: (zones || []) as PricingZone[],
		urgencyFees: (urgencyFees || []) as UrgencyFee[]
	};
};

export const actions: Actions = {
	savePricing: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const pricingModel = formData.get('pricing_model') as string;
		const baseFee = parseFloat(formData.get('base_fee') as string) || 0;
		const perKmRate = parseFloat(formData.get('per_km_rate') as string) || 0;

		const { client_id } = params;

		// Upsert pricing configuration
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: upsertError } = await (supabase as any).from('client_pricing').upsert(
			{
				client_id,
				pricing_model: pricingModel,
				base_fee: baseFee,
				per_km_rate: perKmRate
			},
			{ onConflict: 'client_id' }
		);

		if (upsertError) {
			return { success: false, error: upsertError.message };
		}

		return { success: true };
	},

	saveZones: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const zonesJson = formData.get('zones') as string;
		const zones = JSON.parse(zonesJson) as { min_km: number; max_km: number | null; price: number }[];

		const { client_id } = params;

		// Use atomic RPC function to replace zones (DELETE + INSERT in single transaction)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: rpcError } = await (supabase as any).rpc('replace_pricing_zones', {
			p_client_id: client_id,
			p_zones: zones
		});

		if (rpcError) {
			return { success: false, error: rpcError.message };
		}

		return { success: true };
	}
};
