import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase } = await parent();

	// Public page - no auth guard needed
	// Session will be created when user clicks invite link

	return { supabase };
};
