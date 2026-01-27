/**
 * Shared scheduling constants used across the application.
 * Single source of truth for time slots, working days, and past due settings.
 */

import type { TimeSlotDefinitions, WorkingDay, PastDueSettings, NotificationPreferences } from '$lib/database.types';

export const DEFAULT_TIME_SLOTS: TimeSlotDefinitions = {
	morning: { start: '08:00', end: '12:00' },
	afternoon: { start: '12:00', end: '17:00' },
	evening: { start: '17:00', end: '21:00' }
};

export const DEFAULT_WORKING_DAYS: WorkingDay[] = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday'
];

export const DEFAULT_PAST_DUE_SETTINGS: PastDueSettings = {
	gracePeriodStandard: 30,
	gracePeriodSpecific: 15,
	thresholdApproaching: 120,
	thresholdUrgent: 60,
	thresholdCriticalHours: 24,
	allowClientReschedule: true,
	clientMinNoticeHours: 24,
	clientMaxReschedules: 3,
	pastDueReminderInterval: 60,
	dailySummaryEnabled: true,
	dailySummaryTime: '08:00'
};

// SYNC WARNING: Default values must match DEFAULT_PREFS in supabase/functions/_shared/notify.ts
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
	categories: {
		new_request: { inApp: true, push: true, email: true },
		schedule_change: { inApp: true, push: true, email: false },
		past_due: { inApp: true, push: true, email: false },
		daily_summary: { inApp: true, push: false, email: true },
		service_status: { inApp: true, push: false, email: true }
	},
	quietHours: {
		enabled: false,
		start: '21:00',
		end: '08:00'
	},
	workingDaysOnly: true
};

export const VALID_DAYS: readonly WorkingDay[] = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday'
];

export const VALID_TIMEZONES = [
	'Europe/Lisbon',
	'Europe/London',
	'Europe/Paris',
	'Europe/Madrid',
	'Atlantic/Azores',
	'Atlantic/Madeira'
] as const;

export type ValidTimezone = (typeof VALID_TIMEZONES)[number];
