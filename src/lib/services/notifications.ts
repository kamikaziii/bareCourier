import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { waitUntil } from '@vercel/functions';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Result of a notification operation
 */
export type NotificationResult =
	| { success: true }
	| { success: false; error: string };

/**
 * Get courier ID
 */
async function getCourierId(supabase: SupabaseClient): Promise<string | null> {
	const { data } = await supabase
		.from('courier_public_profile')
		.select('id')
		.single();

	return data?.id ?? null;
}

/**
 * Supported locales for the app
 */
export type AppLocale = 'en' | 'pt-PT';

/**
 * Get a user's preferred locale from their profile
 * Falls back to 'pt-PT' if not set (app default)
 */
export async function getUserLocale(supabase: SupabaseClient, userId: string): Promise<AppLocale> {
	const { data } = await supabase
		.from('profiles')
		.select('locale')
		.eq('id', userId)
		.single();

	const locale = data?.locale;
	if (locale === 'en' || locale === 'pt-PT') {
		return locale;
	}
	return 'pt-PT'; // Default locale
}

/**
 * Get courier's preferred locale
 * Falls back to 'pt-PT' if not set
 */
export async function getCourierLocale(supabase: SupabaseClient): Promise<AppLocale> {
	const { data } = await supabase
		.from('courier_public_profile')
		.select('locale')
		.single();

	const locale = data?.locale;
	if (locale === 'en' || locale === 'pt-PT') {
		return locale;
	}
	return 'pt-PT'; // Default locale
}

/**
 * Send notification to a client
 */
export async function notifyClient(params: {
	session: { access_token: string };
	clientId: string;
	serviceId: string;
	category: 'schedule_change' | 'service_status' | 'new_request';
	title: string;
	message: string;
	emailTemplate?: string;
	emailData?: Record<string, string>;
}): Promise<NotificationResult> {
	const { session, clientId, serviceId, category, title, message, emailTemplate, emailData } = params;

	try {
		const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${session.access_token}`,
				apikey: PUBLIC_SUPABASE_ANON_KEY
			},
			body: JSON.stringify({
				user_id: clientId,
				category,
				title,
				message,
				service_id: serviceId,
				email_template: emailTemplate,
				email_data: emailData
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Notification failed:', response.status, errorText);
			return { success: false, error: `HTTP ${response.status}: ${errorText}` };
		}

		return { success: true };
	} catch (error) {
		console.error('Notification error:', error);
		return { success: false, error: String(error) };
	}
}

/**
 * Send notification to the courier
 */
export async function notifyCourier(params: {
	supabase: SupabaseClient;
	session: { access_token: string };
	serviceId: string;
	category: 'schedule_change' | 'new_request' | 'service_status';
	title: string;
	message: string;
	emailTemplate?: string;
	emailData?: Record<string, string>;
}): Promise<NotificationResult> {
	const { supabase, session, serviceId, category, title, message, emailTemplate, emailData } = params;

	try {
		const courierId = await getCourierId(supabase);

		if (!courierId) {
			console.warn('No courier found to notify');
			return { success: false, error: 'No courier found in system' };
		}

		const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${session.access_token}`,
				apikey: PUBLIC_SUPABASE_ANON_KEY
			},
			body: JSON.stringify({
				user_id: courierId,
				category,
				title,
				message,
				service_id: serviceId,
				email_template: emailTemplate,
				email_data: emailData
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Notification failed:', response.status, errorText);
			return { success: false, error: `HTTP ${response.status}: ${errorText}` };
		}

		return { success: true };
	} catch (error) {
		console.error('Notification error:', error);
		return { success: false, error: String(error) };
	}
}

/**
 * Fire-and-forget a notification. Uses Vercel's waitUntil() to keep
 * the serverless function alive until the notification completes,
 * without blocking the response to the user.
 */
export function backgroundNotify(promise: Promise<unknown>): void {
	waitUntil(promise);
}
