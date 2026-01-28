/**
 * Push Notification Service
 * Manages Web Push subscription for PWA notifications
 */

import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
	return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (!('Notification' in window)) {
		return 'denied';
	}
	return await Notification.requestPermission();
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
	if (!('Notification' in window)) {
		return 'denied';
	}
	return Notification.permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
	supabase: SupabaseClient,
	userId: string
): Promise<{ success: boolean; error?: string }> {
	if (!isPushSupported()) {
		return { success: false, error: 'Push notifications not supported' };
	}

	if (!PUBLIC_VAPID_PUBLIC_KEY) {
		return { success: false, error: 'VAPID key not configured' };
	}

	const permission = await requestNotificationPermission();
	if (permission !== 'granted') {
		return { success: false, error: 'Notification permission denied' };
	}

	try {
		const registration = await navigator.serviceWorker.ready;

		// Check for existing subscription
		let subscription = await registration.pushManager.getSubscription();

		if (!subscription) {
			// Create new subscription
			const applicationServerKey = urlBase64ToUint8Array(PUBLIC_VAPID_PUBLIC_KEY);
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: applicationServerKey as BufferSource
			});
		}

		// Save subscription to database
		const subscriptionJson = subscription.toJSON();
		const { error } = await supabase.from('push_subscriptions').upsert(
			{
				user_id: userId,
				endpoint: subscriptionJson.endpoint!,
				p256dh: subscriptionJson.keys?.p256dh || '',
				auth: subscriptionJson.keys?.auth || ''
			},
			{
				onConflict: 'user_id,endpoint'
			}
		);

		if (error) {
			console.error('Failed to save subscription:', error);
			return { success: false, error: error.message };
		}

		return { success: true };
	} catch (error) {
		console.error('Push subscription error:', error);
		return { success: false, error: (error as Error).message };
	}
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
	supabase: SupabaseClient,
	userId: string
): Promise<{ success: boolean; error?: string }> {
	if (!isPushSupported()) {
		return { success: false, error: 'Push notifications not supported' };
	}

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();

		if (subscription) {
			// Unsubscribe from push
			await subscription.unsubscribe();

			// Remove from database
			await supabase
				.from('push_subscriptions')
				.delete()
				.eq('user_id', userId)
				.eq('endpoint', subscription.endpoint);
		}

		return { success: true };
	} catch (error) {
		console.error('Push unsubscription error:', error);
		return { success: false, error: (error as Error).message };
	}
}

/**
 * Check if user is subscribed to push notifications
 */
export async function isSubscribedToPush(): Promise<boolean> {
	if (!isPushSupported()) {
		return false;
	}

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		return subscription !== null;
	} catch {
		return false;
	}
}

/**
 * Convert URL-safe base64 to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}
