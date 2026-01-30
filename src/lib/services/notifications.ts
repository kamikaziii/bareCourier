import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get courier ID
 */
async function getCourierId(supabase: SupabaseClient): Promise<string | null> {
	const { data } = await supabase
		.from('profiles')
		.select('id')
		.eq('role', 'courier')
		.single();

	return data?.id ?? null;
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
}): Promise<void> {
	const { session, clientId, serviceId, category, title, message, emailTemplate, emailData } = params;

	try {
		await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
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
	} catch (error) {
		console.error('Notification error:', error);
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
}): Promise<void> {
	const { supabase, session, serviceId, category, title, message, emailTemplate, emailData } = params;

	try {
		const courierId = await getCourierId(supabase);

		if (!courierId) {
			console.warn('No courier found to notify');
			return;
		}

		await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
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
	} catch (error) {
		console.error('Notification error:', error);
	}
}
