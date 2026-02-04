import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { getLocale } from './translations.ts';

// SYNC WARNING: These notification types (NotificationCategory, ChannelPreferences, NotificationPreferences)
// must match the definitions in src/lib/database.types.ts
export type NotificationCategory =
	| 'new_request'
	| 'schedule_change'
	| 'past_due'
	| 'daily_summary'
	| 'service_status';

type ChannelPreferences = {
	inApp: boolean;
	push: boolean;
	email: boolean;
};

type NotificationPreferences = {
	categories: Record<NotificationCategory, ChannelPreferences>;
	quietHours: {
		enabled: boolean;
		start: string;
		end: string;
	};
	workingDaysOnly: boolean;
};

type DispatchResult = {
	inApp: { success: boolean; notificationId?: string; error?: string };
	push: { success: boolean; error?: string } | null;
	email: { success: boolean; emailId?: string; error?: string } | null;
};

interface DispatchParams {
	supabase: SupabaseClient;
	userId: string;
	category: NotificationCategory;
	title: string;
	message: string;
	serviceId?: string;
	emailTemplate?: string;
	emailData?: Record<string, string>;
	profile?: Record<string, unknown>; // Pre-fetched profile to avoid redundant queries
}

// SYNC WARNING: Default values must match DEFAULT_NOTIFICATION_PREFERENCES in src/lib/constants/scheduling.ts
const DEFAULT_PREFS: NotificationPreferences = {
	categories: {
		new_request: { inApp: true, push: true, email: true },
		schedule_change: { inApp: true, push: true, email: false },
		past_due: { inApp: true, push: true, email: false },
		daily_summary: { inApp: true, push: false, email: true },
		service_status: { inApp: true, push: false, email: true }
	},
	quietHours: { enabled: false, start: '21:00', end: '08:00' },
	workingDaysOnly: true
};

/**
 * Check if current time is within quiet hours.
 * Handles midnight-spanning ranges (e.g., 21:00 to 08:00).
 */
export function isWithinQuietHours(
	now: Date,
	start: string,
	end: string,
	timezone: string
): boolean {
	const localTime = now.toLocaleTimeString('en-GB', {
		timeZone: timezone,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	const [nowHour, nowMin] = localTime.split(':').map(Number);
	const [startHour, startMin] = start.split(':').map(Number);
	const [endHour, endMin] = end.split(':').map(Number);

	const nowMinutes = nowHour * 60 + nowMin;
	const startMinutes = startHour * 60 + startMin;
	const endMinutes = endHour * 60 + endMin;

	if (startMinutes <= endMinutes) {
		return nowMinutes >= startMinutes && nowMinutes < endMinutes;
	} else {
		// Midnight-spanning range
		return nowMinutes >= startMinutes || nowMinutes < endMinutes;
	}
}

function isWorkingDay(now: Date, workingDays: string[], timezone: string): boolean {
	const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone })
		.format(now)
		.toLowerCase();
	return workingDays.includes(todayName);
}

export async function dispatchNotification(params: DispatchParams): Promise<DispatchResult> {
	const { supabase, userId, category, title, message, serviceId, emailTemplate, emailData } =
		params;
	const now = new Date();

	// Load user profile (use pre-fetched if available)
	const profile = params.profile ?? (await supabase
		.from('profiles')
		.select(
			'notification_preferences, timezone, working_days, push_notifications_enabled, email_notifications_enabled, locale'
		)
		.eq('id', userId)
		.single()).data;

	const prefs: NotificationPreferences = profile?.notification_preferences ?? DEFAULT_PREFS;
	const timezone = profile?.timezone || 'Europe/Lisbon';
	const workingDays = profile?.working_days || [
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday'
	];
	const categoryPrefs = prefs.categories[category] || { inApp: true, push: false, email: false };

	const result: DispatchResult = {
		inApp: { success: false },
		push: null,
		email: null
	};

	// Check quiet hours and working days for external channels (needed for email_status decision)
	const isQuiet =
		prefs.quietHours.enabled &&
		isWithinQuietHours(now, prefs.quietHours.start, prefs.quietHours.end, timezone);
	const isWorking = !prefs.workingDaysOnly || isWorkingDay(now, workingDays, timezone);
	const canSendExternal = !isQuiet && isWorking;

	// Determine if email will be sent (for setting initial email_status)
	const willSendEmail =
		categoryPrefs.email && profile?.email_notifications_enabled && canSendExternal && emailTemplate;

	// 1. Always create in-app notification
	// Set email_status = 'pending' only if email will be sent (avoids false positives for old/non-email notifications)
	const { data: notif, error: notifError } = await supabase
		.from('notifications')
		.insert({
			user_id: userId,
			type: category,
			title,
			message,
			service_id: serviceId || null,
			email_status: willSendEmail ? 'pending' : null
		})
		.select('id')
		.single();

	if (notifError) {
		result.inApp = { success: false, error: notifError.message };
	} else {
		result.inApp = { success: true, notificationId: notif.id };
	}

	// 2. Send push if enabled
	if (categoryPrefs.push && profile?.push_notifications_enabled && canSendExternal) {
		try {
			const pushUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`;
			const response = await fetch(pushUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
				},
				body: JSON.stringify({
					user_id: userId,
					title,
					message,
					service_id: serviceId
				})
			});
			const pushResult = await response.json();
			result.push = { success: pushResult.success ?? false, error: pushResult.error };
		} catch (e) {
			result.push = { success: false, error: (e as Error).message };
		}
	}

	// 3. Send email if enabled (uses willSendEmail computed earlier)
	if (willSendEmail) {
		try {
			const locale = getLocale(profile?.locale as string | null | undefined);
			const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`;
			const response = await fetch(emailUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
				},
				body: JSON.stringify({
					user_id: userId,
					template: emailTemplate,
					data: { ...(emailData || {}), locale }
				})
			});
			const emailResult = await response.json();
			const emailId = emailResult.email_id;
			result.email = { success: emailResult.success ?? false, emailId, error: emailResult.error };

			// Update notification with email tracking info
			if (result.inApp.notificationId) {
				await supabase
					.from('notifications')
					.update({
						email_sent_at: emailResult.success ? new Date().toISOString() : null,
						email_id: emailId || null,
						email_status: emailResult.success ? 'sent' : 'failed'
					})
					.eq('id', result.inApp.notificationId);
			}
		} catch (e) {
			result.email = { success: false, error: (e as Error).message };
			// Update notification with failed status
			if (result.inApp.notificationId) {
				await supabase
					.from('notifications')
					.update({ email_status: 'failed' })
					.eq('id', result.inApp.notificationId);
			}
		}
	}

	return result;
}
