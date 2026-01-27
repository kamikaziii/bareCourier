import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, ClientPricing, PricingZone } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Load client profile first (must validate exists before other queries)
	const { data: client, error: clientError } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', params.id)
		.eq('role', 'client')
		.single();

	if (clientError || !client) {
		error(404, 'Client not found');
	}

	// Load pricing and zones in parallel (client validated, safe to proceed)
	const [pricingResult, zonesResult] = await Promise.all([
		supabase.from('client_pricing').select('*').eq('client_id', params.id).single(),
		supabase.from('pricing_zones').select('*').eq('client_id', params.id).order('min_km')
	]);

	return {
		client: client as Profile,
		pricing: pricingResult.data as ClientPricing | null,
		zones: (zonesResult.data || []) as PricingZone[]
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify user is courier
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();

		const name = formData.get('name') as string;
		const phone = formData.get('phone') as string;
		const default_pickup_location = formData.get('default_pickup_location') as string;

		// Pricing fields
		const pricingModel = formData.get('pricing_model') as string | null;
		const baseFee = formData.get('base_fee') as string | null;
		const perKmRate = formData.get('per_km_rate') as string | null;
		const zonesJson = formData.get('zones') as string | null;

		if (!name) {
			return { success: false, error: 'Name is required' };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('profiles')
			.update({
				name,
				phone: phone || null,
				default_pickup_location: default_pickup_location || null
			})
			.eq('id', params.id);

		if (updateError) {
			console.error('Failed to update client profile:', updateError);
			return { success: false, error: 'Failed to update client' };
		}

		// Save pricing configuration if provided
		if (pricingModel) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const { error: pricingError } = await (supabase as any).from('client_pricing').upsert(
				{
					client_id: params.id,
					pricing_model: pricingModel,
					base_fee: parseFloat(baseFee || '0') || 0,
					per_km_rate: parseFloat(perKmRate || '0') || 0
				},
				{ onConflict: 'client_id' }
			);

			if (pricingError) {
				console.error('Failed to save client pricing:', pricingError);
				return { success: false, error: 'Failed to save pricing configuration' };
			}

			// If zone pricing, save zones using atomic RPC
			if (pricingModel === 'zone' && zonesJson) {
				let zones: { min_km: number; max_km: number | null; price: number }[];
				try {
					zones = JSON.parse(zonesJson);
				} catch {
					return { success: false, error: 'Invalid zone configuration format' };
				}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const { error: rpcError } = await (supabase as any).rpc('replace_pricing_zones', {
					p_client_id: params.id,
					p_zones: zones
				});

				if (rpcError) {
					console.error('Failed to save pricing zones:', rpcError);
					return { success: false, error: 'Failed to save pricing zones' };
				}
			}
		}

		redirect(303, localizeHref(`/courier/clients/${params.id}`));
	}
};
