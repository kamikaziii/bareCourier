import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, Service, ClientPricing, PricingZone } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// First: validate client exists (must complete before other queries)
	const { data: client, error: clientError } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', params.id)
		.eq('role', 'client')
		.single();

	if (clientError || !client) {
		error(404, 'Client not found');
	}

	// Then: parallel queries for remaining data
	const [servicesResult, pricingResult, zonesResult] = await Promise.all([
		supabase
			.from('services')
			.select('*')
			.eq('client_id', params.id)
			.is('deleted_at', null)
			.order('created_at', { ascending: false }),
		supabase.from('client_pricing').select('*').eq('client_id', params.id).single(),
		supabase.from('pricing_zones').select('*').eq('client_id', params.id).order('min_km')
	]);

	const { data: services } = servicesResult;
	const { data: pricing } = pricingResult;
	const { data: zones } = zonesResult;

	// Calculate statistics
	const allServices = (services || []) as Service[];
	const pendingCount = allServices.filter((s) => s.status === 'pending').length;
	const deliveredCount = allServices.filter((s) => s.status === 'delivered').length;

	return {
		client: client as Profile,
		services: allServices,
		stats: {
			total: allServices.length,
			pending: pendingCount,
			delivered: deliveredCount
		},
		pricing: pricing as ClientPricing | null,
		zones: (zones || []) as PricingZone[]
	};
};

export const actions: Actions = {
	toggleActive: async ({ params, locals: { supabase, safeGetSession } }) => {
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

		// Get current status
		const { data: client } = await supabase
			.from('profiles')
			.select('active')
			.eq('id', params.id)
			.single();

		if (!client) {
			return { success: false, error: 'Client not found' };
		}

		const clientData = client as { active: boolean };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: updateError } = await (supabase as any)
			.from('profiles')
			.update({ active: !clientData.active })
			.eq('id', params.id);

		if (updateError) {
			return { success: false, error: updateError.message };
		}

		return { success: true };
	},

	savePricing: async ({ params, request, locals: { supabase, safeGetSession } }) => {
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
		const pricingModel = formData.get('pricing_model') as string;
		const baseFee = parseFloat(formData.get('base_fee') as string) || 0;
		const perKmRate = parseFloat(formData.get('per_km_rate') as string) || 0;
		const zonesJson = formData.get('zones') as string;

		// Upsert pricing configuration
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: upsertError } = await (supabase as any).from('client_pricing').upsert(
			{
				client_id: params.id,
				pricing_model: pricingModel,
				base_fee: baseFee,
				per_km_rate: perKmRate
			},
			{ onConflict: 'client_id' }
		);

		if (upsertError) {
			return { success: false, error: upsertError.message };
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
				return { success: false, error: rpcError.message };
			}
		}

		return { success: true };
	}
};
