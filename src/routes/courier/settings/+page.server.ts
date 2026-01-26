import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Profile, UrgencyFee } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';

// Validation helpers
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const VALID_TIMEZONES = ['Europe/Lisbon', 'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Atlantic/Azores', 'Atlantic/Madeira'] as const;

function isValidTime(time: string): boolean {
	return TIME_REGEX.test(time);
}

function isValidTimeRange(start: string, end: string): boolean {
	return isValidTime(start) && isValidTime(end) && start < end;
}

function isValidWorkingDay(day: string): day is (typeof VALID_DAYS)[number] {
	return VALID_DAYS.includes(day as (typeof VALID_DAYS)[number]);
}

function isValidTimezone(tz: string): tz is (typeof VALID_TIMEZONES)[number] {
	return VALID_TIMEZONES.includes(tz as (typeof VALID_TIMEZONES)[number]);
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load courier profile
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	if (!profile) {
		redirect(303, localizeHref('/login'));
	}

	// Load urgency fees
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { data: urgencyFees } = await (supabase as any)
		.from('urgency_fees')
		.select('*')
		.order('sort_order');

	return {
		profile: profile as Profile,
		urgencyFees: (urgencyFees || []) as UrgencyFee[]
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const phone = formData.get('phone') as string;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ name, phone })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'profile_updated' };
	},

	updateUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single() as { data: { role: string } | null };

		if (profile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const multiplier = parseFloat(formData.get('multiplier') as string) || 1.0;
		const flatFee = parseFloat(formData.get('flat_fee') as string) || 0;
		const active = formData.get('active') === 'true';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('urgency_fees')
			.update({
				name,
				description,
				multiplier,
				flat_fee: flatFee,
				active
			})
			.eq('id', id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'urgency_updated' };
	},

	createUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single() as { data: { role: string } | null };

		if (profile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const multiplier = parseFloat(formData.get('multiplier') as string) || 1.0;
		const flatFee = parseFloat(formData.get('flat_fee') as string) || 0;

		// Get max sort_order
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { data: maxOrder } = await (supabase as any)
			.from('urgency_fees')
			.select('sort_order')
			.order('sort_order', { ascending: false })
			.limit(1)
			.single();

		const sortOrder = ((maxOrder as { sort_order: number } | null)?.sort_order || 0) + 1;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any).from('urgency_fees').insert({
			name,
			description,
			multiplier,
			flat_fee: flatFee,
			sort_order: sortOrder
		});

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'urgency_created' };
	},

	toggleUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single() as { data: { role: string } | null };

		if (profile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const active = formData.get('active') === 'true';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('urgency_fees')
			.update({ active: !active })
			.eq('id', id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'urgency_toggled' };
	},

	deleteUrgencyFee: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify courier role
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single() as { data: { role: string } | null };

		if (profile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		// Check if this urgency fee is in use by any services
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { count } = await (supabase as any)
			.from('services')
			.select('id', { count: 'exact', head: true })
			.eq('urgency_fee_id', id);

		if (count && count > 0) {
			return { success: false, error: 'urgency_in_use' };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any).from('urgency_fees').delete().eq('id', id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'urgency_deleted' };
	},

	updateNotificationPreferences: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const emailNotificationsEnabled = formData.get('email_notifications_enabled') === 'true';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ email_notifications_enabled: emailNotificationsEnabled })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'notifications_updated' };
	},

	updatePricingMode: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const pricingMode = formData.get('pricing_mode') as 'warehouse' | 'zone';

		if (!['warehouse', 'zone'].includes(pricingMode)) {
			return { success: false, error: 'Invalid pricing mode' };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ pricing_mode: pricingMode })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'pricing_mode_updated' };
	},

	updateWarehouseLocation: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const default_pickup_location = formData.get('default_pickup_location') as string;
		const warehouse_lat = formData.get('warehouse_lat') as string;
		const warehouse_lng = formData.get('warehouse_lng') as string;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({
				default_pickup_location: default_pickup_location || null,
				warehouse_lat: warehouse_lat ? parseFloat(warehouse_lat) : null,
				warehouse_lng: warehouse_lng ? parseFloat(warehouse_lng) : null
			})
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'warehouse_updated' };
	},

	updatePricingPreferences: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const show_price_to_courier = formData.get('show_price_to_courier') === 'true';
		const show_price_to_client = formData.get('show_price_to_client') === 'true';
		const default_urgency_fee_id = (formData.get('default_urgency_fee_id') as string) || null;
		const minimum_charge = parseFloat(formData.get('minimum_charge') as string) || 0;
		const round_distance = formData.get('round_distance') === 'true';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({
				show_price_to_courier,
				show_price_to_client,
				default_urgency_fee_id: default_urgency_fee_id || null,
				minimum_charge,
				round_distance
			})
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'pricing_preferences_updated' };
	},

	updatePastDueSettings: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();

		// Helper to parse int with bounds validation (handles 0 correctly, unlike || default)
		const parseIntWithBounds = (value: FormDataEntryValue | null, min: number, max: number, defaultVal: number): number => {
			if (value === null || value === '') return defaultVal;
			const parsed = parseInt(value as string, 10);
			if (Number.isNaN(parsed)) return defaultVal;
			return Math.max(min, Math.min(max, parsed));
		};

		const gracePeriodStandard = parseIntWithBounds(formData.get('gracePeriodStandard'), 0, 60, 30);
		const gracePeriodSpecific = parseIntWithBounds(formData.get('gracePeriodSpecific'), 0, 30, 15);
		const thresholdApproaching = parseIntWithBounds(formData.get('thresholdApproaching'), 30, 180, 120);
		const thresholdUrgent = parseIntWithBounds(formData.get('thresholdUrgent'), 15, 120, 60);
		const thresholdCriticalHours = parseIntWithBounds(formData.get('thresholdCriticalHours'), 1, 72, 24);

		// Get current settings to preserve client reschedule fields
		const { data: currentProfile } = await supabase
			.from('profiles')
			.select('past_due_settings')
			.eq('id', user.id)
			.single();

		const currentSettings = (currentProfile as unknown as { past_due_settings: Record<string, unknown> | null })?.past_due_settings || {};

		const updatedSettings = {
			...currentSettings,
			gracePeriodStandard,
			gracePeriodSpecific,
			thresholdApproaching,
			thresholdUrgent,
			thresholdCriticalHours
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ past_due_settings: updatedSettings })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'past_due_settings_updated' };
	},

	updateClientRescheduleSettings: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const allowClientReschedule = formData.get('allowClientReschedule') === 'true';

		// Helper to parse int with bounds validation
		const parseIntWithBounds = (value: FormDataEntryValue | null, min: number, max: number, defaultVal: number): number => {
			if (value === null || value === '') return defaultVal;
			const parsed = parseInt(value as string, 10);
			if (Number.isNaN(parsed)) return defaultVal;
			return Math.max(min, Math.min(max, parsed));
		};

		const clientMinNoticeHours = parseIntWithBounds(formData.get('clientMinNoticeHours'), 1, 72, 24);
		const clientMaxReschedules = parseIntWithBounds(formData.get('clientMaxReschedules'), 1, 10, 3);

		// Get current settings to preserve threshold fields
		const { data: currentProfile } = await supabase
			.from('profiles')
			.select('past_due_settings')
			.eq('id', user.id)
			.single();

		const currentSettings = (currentProfile as unknown as { past_due_settings: Record<string, unknown> | null })?.past_due_settings || {};

		const updatedSettings = {
			...currentSettings,
			allowClientReschedule,
			clientMinNoticeHours,
			clientMaxReschedules
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ past_due_settings: updatedSettings })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'client_reschedule_settings_updated' };
	},

	updateNotificationSettings: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const pastDueReminderInterval = parseInt(formData.get('pastDueReminderInterval') as string) || 0;
		const dailySummaryEnabled = formData.get('dailySummaryEnabled') === 'true';
		const dailySummaryTime = (formData.get('dailySummaryTime') as string) || '08:00';

		// Get current settings
		const { data: currentProfile } = await supabase
			.from('profiles')
			.select('past_due_settings')
			.eq('id', user.id)
			.single();

		const currentSettings = (currentProfile as unknown as { past_due_settings: Record<string, unknown> | null })?.past_due_settings || {};

		// Merge with new notification settings
		const updatedSettings = {
			...currentSettings,
			pastDueReminderInterval,
			dailySummaryEnabled,
			dailySummaryTime
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ past_due_settings: updatedSettings })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'notification_settings_updated' };
	},

	updateTimeSlots: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const timeSlots = {
			morning: {
				start: formData.get('morning_start') as string,
				end: formData.get('morning_end') as string
			},
			afternoon: {
				start: formData.get('afternoon_start') as string,
				end: formData.get('afternoon_end') as string
			},
			evening: {
				start: formData.get('evening_start') as string,
				end: formData.get('evening_end') as string
			}
		};

		// Validate all time slots
		for (const [slot, times] of Object.entries(timeSlots)) {
			if (!isValidTimeRange(times.start, times.end)) {
				return { success: false, error: `Invalid time range for ${slot}` };
			}
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ time_slots: timeSlots })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'time_slots_updated' };
	},

	updateWorkingDays: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const workingDays = formData.getAll('working_days') as string[];

		// Validate all days
		const invalidDays = workingDays.filter((day) => !isValidWorkingDay(day));
		if (invalidDays.length > 0) {
			return { success: false, error: `Invalid working days: ${invalidDays.join(', ')}` };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ working_days: workingDays })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'working_days_updated' };
	},

	updateTimezone: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) {
			return { success: false, error: 'Not authenticated' };
		}

		const formData = await request.formData();
		const timezone = formData.get('timezone') as string;

		// Validate timezone
		if (!isValidTimezone(timezone)) {
			return { success: false, error: 'Invalid timezone' };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (supabase as any)
			.from('profiles')
			.update({ timezone })
			.eq('id', user.id);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, message: 'timezone_updated' };
	}
};
