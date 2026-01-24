import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { localizeHref } from '$lib/paraglide/runtime.js';

// Redirect to new Insights page (Data tab)
export const load: PageServerLoad = async () => {
	redirect(301, localizeHref('/courier/insights?tab=data'));
};
