import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, Service, ClientPricing, PricingZone } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ params, url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const offset = (page - 1) * PAGE_SIZE;

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

	// Then: parallel queries for remaining data + DB-side counts
	const [servicesResult, totalCountResult, pendingCountResult, deliveredCountResult, pricingResult, zonesResult] = await Promise.all([
		supabase
			.from('services')
			.select('*')
			.eq('client_id', params.id)
			.is('deleted_at', null)
			.order('created_at', { ascending: false })
			.range(offset, offset + PAGE_SIZE - 1),
		supabase
			.from('services')
			.select('id', { count: 'exact', head: true })
			.eq('client_id', params.id)
			.is('deleted_at', null),
		supabase
			.from('services')
			.select('id', { count: 'exact', head: true })
			.eq('client_id', params.id)
			.is('deleted_at', null)
			.eq('status', 'pending'),
		supabase
			.from('services')
			.select('id', { count: 'exact', head: true })
			.eq('client_id', params.id)
			.is('deleted_at', null)
			.eq('status', 'delivered'),
		supabase.from('client_pricing').select('*').eq('client_id', params.id).single(),
		supabase.from('pricing_zones').select('*').eq('client_id', params.id).order('min_km')
	]);

	const { data: services } = servicesResult;
	const { data: pricing } = pricingResult;
	const { data: zones } = zonesResult;

	const totalCount = totalCountResult.count ?? 0;
	const pendingCount = pendingCountResult.count ?? 0;
	const deliveredCount = deliveredCountResult.count ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

	return {
		client: client as Profile,
		services: (services || []) as Service[],
		stats: {
			total: totalCount,
			pending: pendingCount,
			delivered: deliveredCount
		},
		pagination: {
			page,
			totalPages,
			pageSize: PAGE_SIZE,
			totalCount
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
		const { error: updateError } = await supabase
			.from('profiles')
			.update({ active: !clientData.active })
			.eq('id', params.id);

		if (updateError) {
			console.error('Failed to toggle client active:', updateError);
			return { success: false, error: 'Failed to update client status' };
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
		const { error: upsertError } = await supabase.from('client_pricing').upsert(
			{
				client_id: params.id,
				pricing_model: pricingModel,
				base_fee: baseFee,
				per_km_rate: perKmRate
			},
			{ onConflict: 'client_id' }
		);

		if (upsertError) {
			console.error('Failed to save pricing:', upsertError);
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

		return { success: true };
	}
};
