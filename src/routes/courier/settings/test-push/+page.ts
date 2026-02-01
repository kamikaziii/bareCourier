import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, profile } = await parent();
	return { supabase, profile };
};
