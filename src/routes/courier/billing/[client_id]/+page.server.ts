import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, ClientPricing, PricingZone, UrgencyFee } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import { getCourierPricingSettings } from '$lib/services/pricing.js';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	const { client_id } = params;

	// Load all data in parallel for better performance
	const [clientResult, pricingResult, zonesResult, urgencyFeesResult] = await Promise.all([
		// Load client profile
		supabase.from('profiles').select('*').eq('id', client_id).eq('role', 'client').single(),
		// Load client's pricing configuration
		supabase.from('client_pricing').select('*').eq('client_id', client_id).single(),
		// Load pricing zones if zone pricing model
		supabase.from('pricing_zones').select('*').eq('client_id', client_id).order('min_km'),
		// Load urgency fees for reference
		supabase.from('urgency_fees').select('*').eq('active', true).order('sort_order')
	]);

	const client = clientResult.data;
	const pricing = pricingResult.data;
	const zones = zonesResult.data;
	const urgencyFees = urgencyFeesResult.data;

	if (!client) {
		error(404, 'Client not found');
	}

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

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single() as { data: { role: string } | null };

		if (profile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
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
			console.error('Failed to save pricing:', upsertError);
			return { success: false, error: 'Failed to save pricing configuration' };
		}

		return { success: true };
	},

	saveZones: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single() as { data: { role: string } | null };

		if (profile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const zonesJson = formData.get('zones') as string;
		let zones: { min_km: number; max_km: number | null; price: number }[];
		try {
			zones = JSON.parse(zonesJson);
		} catch {
			return { success: false, error: 'Invalid zone configuration format' };
		}

		const { client_id } = params;

		// Use atomic RPC function to replace zones (DELETE + INSERT in single transaction)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error: rpcError } = await (supabase as any).rpc('replace_pricing_zones', {
			p_client_id: client_id,
			p_zones: zones
		});

		if (rpcError) {
			console.error('Failed RPC call:', rpcError);
			return { success: false, error: 'An unexpected error occurred' };
		}

		return { success: true };
	},

	recalculateMissing: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const { client_id } = params;

		// Get date range from form
		const formData = await request.formData();
		const startDate = formData.get('start_date') as string;
		const endDate = formData.get('end_date') as string;

		// Get services with missing prices within date range
		let query = supabase
			.from('services')
			.select('id')
			.eq('client_id', client_id)
			.is('deleted_at', null)
			.is('calculated_price', null)
			.not('distance_km', 'is', null);

		if (startDate) {
			query = query.gte('created_at', startDate);
		}
		if (endDate) {
			// Add one day to include the end date fully
			const endDatePlusOne = new Date(endDate);
			endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
			query = query.lt('created_at', endDatePlusOne.toISOString().split('T')[0]);
		}

		const { data: services } = await query;

		if (!services || services.length === 0) {
			return { success: true, recalculated: 0 };
		}

		const courierSettings = await getCourierPricingSettings(supabase);

		// Use bulk RPC to calculate and update all prices in a single call
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: result, error: rpcError } = await (supabase as any).rpc(
			'bulk_recalculate_service_prices',
			{
				p_service_ids: services.map((s: { id: string }) => s.id),
				p_client_id: client_id,
				p_minimum_charge: courierSettings.minimumCharge
			}
		);

		if (rpcError) {
			console.error('Failed RPC call:', rpcError);
			return { success: false, error: 'An unexpected error occurred' };
		}

		// Check RPC-level success (auth check or other validation failure)
		if (result && !result.success) {
			return { success: false, error: result.error || 'Recalculation failed' };
		}

		return { success: true, recalculated: result?.updated || 0 };
	},

	recalculateAll: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const { client_id } = params;

		// Get date range from form
		const formData = await request.formData();
		const startDate = formData.get('start_date') as string;
		const endDate = formData.get('end_date') as string;

		// Get all services (with distance) within date range - only need IDs
		let query = supabase
			.from('services')
			.select('id')
			.eq('client_id', client_id)
			.is('deleted_at', null)
			.not('distance_km', 'is', null);

		if (startDate) {
			query = query.gte('created_at', startDate);
		}
		if (endDate) {
			// Add one day to include the end date fully
			const endDatePlusOne = new Date(endDate);
			endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
			query = query.lt('created_at', endDatePlusOne.toISOString().split('T')[0]);
		}

		const { data: services } = await query;

		if (!services || services.length === 0) {
			return { success: true, recalculated: 0 };
		}

		const courierSettings = await getCourierPricingSettings(supabase);

		// Use bulk RPC to calculate and update all prices in a single call
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: result, error: rpcError } = await (supabase as any).rpc(
			'bulk_recalculate_service_prices',
			{
				p_service_ids: services.map((s: { id: string }) => s.id),
				p_client_id: client_id,
				p_minimum_charge: courierSettings.minimumCharge
			}
		);

		if (rpcError) {
			console.error('Failed RPC call:', rpcError);
			return { success: false, error: 'An unexpected error occurred' };
		}

		// Check RPC-level success (auth check or other validation failure)
		if (result && !result.success) {
			return { success: false, error: result.error || 'Recalculation failed' };
		}

		return { success: true, recalculated: result?.updated || 0 };
	}
};
