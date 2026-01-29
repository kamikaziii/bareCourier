import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { Profile, CourierLayoutProfile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, depends, cookies }) => {
	const { session, user } = await safeGetSession();

	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Declare dependency for manual invalidation of nav counts
	depends('app:nav-counts');

	// Fetch profile and pending request count in parallel
	const [profileResult, pendingRequestsResult, pendingReschedulesResult] = await Promise.all([
		supabase.from('profiles').select('*').eq('id', user.id).single(),
		supabase
			.from('services')
			.select('*', { count: 'exact', head: true })
			.eq('request_status', 'pending')
			.is('deleted_at', null),
		supabase
			.from('services')
			.select('*', { count: 'exact', head: true })
			.not('pending_reschedule_date', 'is', null)
			.is('deleted_at', null)
	]);

	const profile = profileResult.data as Profile | null;

	if (!profile || profile.role !== 'courier') {
		redirect(303, localizeHref('/client'));
	}

	return {
		sidebarCollapsed: cookies.get('sidebar-collapsed') === 'true',
		profile: {
			id: profile.id,
			role: 'courier' as const,
			name: profile.name,
			phone: profile.phone,
			past_due_settings: profile.past_due_settings,
			time_slots: profile.time_slots,
			working_days: profile.working_days,
			timezone: profile.timezone,
			vat_enabled: profile.vat_enabled,
			vat_rate: profile.vat_rate,
			prices_include_vat: profile.prices_include_vat,
			show_price_to_courier: profile.show_price_to_courier,
			show_price_to_client: profile.show_price_to_client,
			workload_settings: profile.workload_settings,
			label_business_name: profile.label_business_name,
			label_tagline: profile.label_tagline
		} satisfies CourierLayoutProfile,
		navCounts: {
			pendingRequests: (pendingRequestsResult.count ?? 0) + (pendingReschedulesResult.count ?? 0)
		}
	};
};
