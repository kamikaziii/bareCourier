import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, ClientPricing, PricingZone, ServiceType } from '$lib/database.types';
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

	// Get courier's pricing mode to determine if we need service types
	const { data: courier } = await supabase
		.from('profiles')
		.select('pricing_mode')
		.eq('role', 'courier')
		.single();

	// Load pricing, zones, and service types in parallel (client validated, safe to proceed)
	const [pricingResult, zonesResult, serviceTypesResult] = await Promise.all([
		supabase.from('client_pricing').select('*').eq('client_id', params.id).single(),
		supabase.from('pricing_zones').select('*').eq('client_id', params.id).order('min_km'),
		courier?.pricing_mode === 'type'
			? supabase.from('service_types').select('*').eq('active', true).order('sort_order')
			: Promise.resolve({ data: [] })
	]);

	return {
		client: client as Profile,
		pricing: pricingResult.data as ClientPricing | null,
		zones: (zonesResult.data || []) as PricingZone[],
		pricingMode: (courier?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse',
		serviceTypes: (serviceTypesResult.data || []) as ServiceType[]
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
		const default_pickup_lat = formData.get('default_pickup_lat')
			? parseFloat(formData.get('default_pickup_lat') as string)
			: null;
		const default_pickup_lng = formData.get('default_pickup_lng')
			? parseFloat(formData.get('default_pickup_lng') as string)
			: null;
		const defaultServiceTypeId = (formData.get('default_service_type_id') as string) || null;

		// Pricing fields
		const pricingModel = formData.get('pricing_model') as string | null;
		const baseFee = formData.get('base_fee') as string | null;
		const perKmRate = formData.get('per_km_rate') as string | null;
		const zonesJson = formData.get('zones') as string | null;

		if (!name) {
			return { success: false, error: 'Name is required' };
		}

		const { error: updateError } = await supabase
			.from('profiles')
			.update({
				name,
				phone: phone || null,
				default_pickup_location: default_pickup_location || null,
				default_pickup_lat: default_pickup_lat,
				default_pickup_lng: default_pickup_lng,
				default_service_type_id: defaultServiceTypeId || null
			})
			.eq('id', params.id);

		if (updateError) {
			console.error('Failed to update client profile:', updateError);
			return { success: false, error: 'Failed to update client' };
		}

		// Save pricing configuration if provided
		if (pricingModel) {
			const { error: pricingError } = await supabase.from('client_pricing').upsert(
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
				const { error: rpcError } = await supabase.rpc('replace_pricing_zones', {
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
