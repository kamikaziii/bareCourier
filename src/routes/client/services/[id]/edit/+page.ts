import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, parent }) => {
	const { supabase } = await parent();

	const { data: service } = await supabase
		.from('services')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!service || service.request_status !== 'pending') {
		redirect(303, `/client/services/${params.id}`);
	}

	return { service, supabase };
};
