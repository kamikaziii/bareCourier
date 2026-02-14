import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	const { data: addresses } = await supabase
		.from('client_addresses')
		.select('*')
		.eq('client_id', user.id)
		.order('label', { ascending: true });

	return {
		addresses: addresses ?? []
	};
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const label = (formData.get('label') as string)?.trim();
		const address = (formData.get('address') as string)?.trim();
		const lat = formData.get('lat') as string;
		const lng = formData.get('lng') as string;

		if (!label) {
			return fail(400, { error: 'Label is required' });
		}
		if (label.length > 100) {
			return fail(400, { error: 'Label too long (max 100 characters)' });
		}
		if (!address) {
			return fail(400, { error: 'Address is required' });
		}
		if (address.length > 500) {
			return fail(400, { error: 'Address too long (max 500 characters)' });
		}

		const { error } = await supabase.from('client_addresses').insert({
			client_id: user.id,
			label,
			address,
			lat: lat ? parseFloat(lat) : null,
			lng: lng ? parseFloat(lng) : null
		});

		if (error) {
			if (error.code === '23505') {
				return fail(400, { error: 'A saved address with this label already exists' });
			}
			console.error('Failed to create address:', error);
			return fail(500, { error: 'Failed to save address' });
		}

		return { success: true };
	},

	update: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const label = (formData.get('label') as string)?.trim();
		const address = (formData.get('address') as string)?.trim();
		const lat = formData.get('lat') as string;
		const lng = formData.get('lng') as string;

		if (!id) {
			return fail(400, { error: 'Address ID is required' });
		}
		if (!label) {
			return fail(400, { error: 'Label is required' });
		}
		if (label.length > 100) {
			return fail(400, { error: 'Label too long (max 100 characters)' });
		}
		if (!address) {
			return fail(400, { error: 'Address is required' });
		}
		if (address.length > 500) {
			return fail(400, { error: 'Address too long (max 500 characters)' });
		}

		const { error } = await supabase
			.from('client_addresses')
			.update({
				label,
				address,
				lat: lat ? parseFloat(lat) : null,
				lng: lng ? parseFloat(lng) : null
			})
			.eq('id', id)
			.eq('client_id', user.id);

		if (error) {
			if (error.code === '23505') {
				return fail(400, { error: 'A saved address with this label already exists' });
			}
			console.error('Failed to update address:', error);
			return fail(500, { error: 'Failed to update address' });
		}

		return { success: true };
	},

	delete: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Address ID is required' });
		}

		const { error } = await supabase
			.from('client_addresses')
			.delete()
			.eq('id', id)
			.eq('client_id', user.id);

		if (error) {
			console.error('Failed to delete address:', error);
			return fail(500, { error: 'Failed to delete address' });
		}

		return { success: true };
	}
};
