import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

// Validation helpers
const VALID_TIMEZONES = ['Europe/Lisbon', 'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Atlantic/Azores', 'Atlantic/Madeira'] as const;
const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALL_NOTIFICATION_CATEGORY_KEYS = ['new_request', 'schedule_change', 'past_due', 'daily_summary', 'service_status'] as const;

function isValidTimezone(tz: string): tz is (typeof VALID_TIMEZONES)[number] {
	return VALID_TIMEZONES.includes(tz as (typeof VALID_TIMEZONES)[number]);
}

function validateClientNotificationPreferences(prefs: unknown): prefs is {
	categories: Record<string, { inApp: boolean; push: boolean; email: boolean }>;
	quietHours: { enabled: boolean; start: string; end: string };
	workingDaysOnly: boolean;
} {
	if (typeof prefs !== 'object' || prefs === null || Array.isArray(prefs)) return false;

	const obj = prefs as Record<string, unknown>;
	const allowedKeys = ['categories', 'quietHours', 'workingDaysOnly'];
	const topKeys = Object.keys(obj);
	if (topKeys.length !== allowedKeys.length || !topKeys.every((k) => allowedKeys.includes(k))) return false;

	// Validate categories — accept all 5 keys (shared component sends all defaults)
	if (typeof obj.categories !== 'object' || obj.categories === null || Array.isArray(obj.categories)) return false;
	const cats = obj.categories as Record<string, unknown>;
	const catKeys = Object.keys(cats);
	if (catKeys.length !== ALL_NOTIFICATION_CATEGORY_KEYS.length || !ALL_NOTIFICATION_CATEGORY_KEYS.every((k) => catKeys.includes(k))) return false;
	for (const key of ALL_NOTIFICATION_CATEGORY_KEYS) {
		const cat = cats[key];
		if (typeof cat !== 'object' || cat === null || Array.isArray(cat)) return false;
		const c = cat as Record<string, unknown>;
		if (typeof c.inApp !== 'boolean' || typeof c.push !== 'boolean' || typeof c.email !== 'boolean') return false;
	}

	// Validate quietHours
	if (typeof obj.quietHours !== 'object' || obj.quietHours === null || Array.isArray(obj.quietHours)) return false;
	const qh = obj.quietHours as Record<string, unknown>;
	if (typeof qh.enabled !== 'boolean') return false;
	if (typeof qh.start !== 'string' || !TIME_FORMAT_REGEX.test(qh.start)) return false;
	if (typeof qh.end !== 'string' || !TIME_FORMAT_REGEX.test(qh.end)) return false;

	// Validate workingDaysOnly
	if (typeof obj.workingDaysOnly !== 'boolean') return false;

	return true;
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load client profile
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	if (!profile) {
		redirect(303, localizeHref('/login'));
	}

	return {
		profile: profile as Profile
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const phone = formData.get('phone') as string;

		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		const { error } = await supabase
			.from('profiles')
			.update({
				name,
				phone
			})
			.eq('id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	updateLocation: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const defaultPickupLocation = formData.get('default_pickup_location') as string;
		const defaultPickupLat = formData.get('default_pickup_lat') as string;
		const defaultPickupLng = formData.get('default_pickup_lng') as string;

		const { error } = await supabase
			.from('profiles')
			.update({
				default_pickup_location: defaultPickupLocation || null,
				default_pickup_lat: defaultPickupLat ? parseFloat(defaultPickupLat) : null,
				default_pickup_lng: defaultPickupLng ? parseFloat(defaultPickupLng) : null
			})
			.eq('id', user.id);

		if (error) {
			return fail(500, { error: error.message });
		}

		return { success: true };
	},

	updateNotificationPreferences: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();

		const notificationPrefsJson = formData.get('notification_preferences') as string | null;
		const emailEnabledStr = formData.get('email_notifications_enabled') as string | null;

		const updateData: Record<string, unknown> = {};

		if (notificationPrefsJson) {
			try {
				const prefs = JSON.parse(notificationPrefsJson);
				if (!validateClientNotificationPreferences(prefs)) {
					return fail(400, { error: 'Invalid notification preferences' });
				}
				updateData.notification_preferences = prefs;
			} catch {
				return fail(400, { error: 'Invalid notification preferences' });
			}
		}

		if (emailEnabledStr !== null) {
			updateData.email_notifications_enabled = emailEnabledStr === 'true';
		}

		if (Object.keys(updateData).length === 0) {
			return fail(400, { error: 'No data to update' });
		}

		const { error } = await supabase
			.from('profiles')
			.update(updateData)
			.eq('id', user.id);

		if (error) {
			return fail(500, { error: 'Failed to update notification preferences' });
		}

		return { success: true };
	},

	updateTimezone: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const timezone = formData.get('timezone') as string;

		if (!isValidTimezone(timezone)) {
			return fail(400, { error: 'Invalid timezone' });
		}

		const { error } = await supabase
			.from('profiles')
			.update({ timezone })
			.eq('id', user.id);

		if (error) {
			return fail(500, { error: 'Failed to update timezone' });
		}

		return { success: true };
	}
};
