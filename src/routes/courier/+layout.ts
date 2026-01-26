import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, data }) => {
	const parentData = await parent();
	return {
		...parentData,
		profile: data.profile,
		navCounts: data.navCounts
	};
};
