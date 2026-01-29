import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
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

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Verify courier role
		const { data: userProfile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (userProfile?.role !== 'courier') {
			return fail(403, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const default_pickup_location = formData.get('default_pickup_location') as string;
		const default_service_type_id = formData.get('default_service_type_id') as string;

		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}
		if (!email?.trim()) {
			return fail(400, { error: 'Email is required' });
		}

		// Create auth user for client using signUp (not admin API)
		const tempPassword = crypto.randomUUID();
		const { data: authData, error: authError } = await supabase.auth.signUp({
			email,
			password: tempPassword,
			options: {
				data: {
					name: name.trim(),
					role: 'client'
				}
			}
		});

		if (authError) {
			return fail(500, { error: authError.message });
		}

		// Update profile with additional data
		if (authData.user) {
			const { error: profileError } = await supabase
				.from('profiles')
				.update({
					phone: phone?.trim() || null,
					default_pickup_location: default_pickup_location?.trim() || null,
					default_service_type_id: default_service_type_id || null
				})
				.eq('id', authData.user.id);

			if (profileError) {
				console.error('Failed to update client profile:', profileError);
				// User was created but profile update failed - log but don't fail
			}
		}

		redirect(303, localizeHref('/courier/clients'));
	}
};
