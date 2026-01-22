import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, UrgencyFee } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load courier profile
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	if (!profile) {
		redirect(303, localizeHref('/login'));
	}

	// Load urgency fees
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data: urgencyFees } = await (supabase as any)
		.from('urgency_fees')
		.select('*')
		.order('sort_order');

	return {
		profile: profile as Profile,
		urgencyFees: (urgencyFees || []) as UrgencyFee[]
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const phone = formData.get('phone') as string;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ name, phone })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'profile_updated' };
	},

	updateUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const multiplier = parseFloat(formData.get('multiplier') as string) || 1.0;
		const flatFee = parseFloat(formData.get('flat_fee') as string) || 0;
		const active = formData.get('active') === 'true';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('urgency_fees')
			.update({
				name,
				description,
				multiplier,
				flat_fee: flatFee,
				active
			})
			.eq('id', id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'urgency_updated' };
	},

	createUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const multiplier = parseFloat(formData.get('multiplier') as string) || 1.0;
		const flatFee = parseFloat(formData.get('flat_fee') as string) || 0;

		// Get max sort_order
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: maxOrder } = await (supabase as any)
			.from('urgency_fees')
			.select('sort_order')
			.order('sort_order', { ascending: false })
			.limit(1)
			.single();

		const sortOrder = ((maxOrder as { sort_order: number } | null)?.sort_order || 0) + 1;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any).from('urgency_fees').insert({
			name,
			description,
			multiplier,
			flat_fee: flatFee,
			sort_order: sortOrder
		});

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'urgency_created' };
	},

	toggleUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const active = formData.get('active') === 'true';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('urgency_fees')
			.update({ active: !active })
			.eq('id', id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'urgency_toggled' };
	},

	deleteUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		// Check if this urgency fee is in use by any services
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: usageCount } = await (supabase as any)
			.from('services')
			.select('id', { count: 'exact', head: true })
			.eq('urgency_fee_id', id);

		if (usageCount && usageCount.length > 0) {
			return { success: false, error: 'urgency_in_use' };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any).from('urgency_fees').delete().eq('id', id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'urgency_deleted' };
	}
};
