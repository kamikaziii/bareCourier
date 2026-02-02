import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase } = await parent();

	// Don't redirect here - we need to allow the password reset flow
	// even if the user has a session (they clicked a reset link)

	return { supabase };
};
