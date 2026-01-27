import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Service } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const load: PageServerLoad = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		redirect(303, localizeHref('/login'));
	}

	// Get month from URL or default to current month
	const monthParam = url.searchParams.get('month');
	let currentMonth: Date;

	if (monthParam) {
		currentMonth = new Date(monthParam + '-01');
		if (isNaN(currentMonth.getTime())) {
			currentMonth = new Date();
		}
	} else {
		currentMonth = new Date();
	}

	// Get first and last day of month
	const year = currentMonth.getFullYear();
	const month = currentMonth.getMonth();
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);

	// Format dates for query
	const firstDayStr = firstDay.toISOString().split('T')[0];
	const lastDayStr = lastDay.toISOString().split('T')[0];
	const firstDayISO = firstDay.toISOString();
	const lastDayISO = new Date(year, month + 1, 1).toISOString();

	// Load client's services for this month (RLS scopes to own services)
	const { data: services } = await supabase
		.from('services')
		.select('id, pickup_location, delivery_location, status, scheduled_date, created_at, request_status, scheduled_time_slot, scheduled_time')
		.is('deleted_at', null)
		.or(
			`and(scheduled_date.gte.${firstDayStr},scheduled_date.lte.${lastDayStr}),` +
			`and(scheduled_date.is.null,created_at.gte.${firstDayISO},created_at.lt.${lastDayISO})`
		)
		.order('scheduled_date', { ascending: true, nullsFirst: false });

	return {
		services: (services || []) as Pick<Service, 'id' | 'pickup_location' | 'delivery_location' | 'status' | 'scheduled_date' | 'created_at' | 'request_status' | 'scheduled_time_slot' | 'scheduled_time'>[],
		currentMonth: currentMonth.toISOString().slice(0, 7)
	};
};
