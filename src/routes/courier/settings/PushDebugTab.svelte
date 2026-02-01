<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { isPushSupported } from '$lib/services/push';
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Profile } from '$lib/database.types.js';

	interface Props {
		profile: Profile;
		supabase: SupabaseClient;
	}

	let { profile, supabase }: Props = $props();

	let diagnostics = $state<Record<string, string | boolean | number | null>>({});
	let testResult = $state('');
	let loading = $state(false);
	let subscriptionDetails = $state<string>('');

	async function runDiagnostics() {
		loading = true;
		diagnostics = {};
		subscriptionDetails = '';

		// 1. Check browser support
		diagnostics['Browser supports Push'] = isPushSupported();
		diagnostics['Notification API available'] = 'Notification' in window;
		diagnostics['Service Worker API available'] = 'serviceWorker' in navigator;
		diagnostics['PushManager available'] = 'PushManager' in window;

		// 2. Check permission
		diagnostics['Notification permission'] = Notification.permission;

		// 3. Check VAPID key
		diagnostics['VAPID public key set'] = !!PUBLIC_VAPID_PUBLIC_KEY;
		diagnostics['VAPID key length'] = PUBLIC_VAPID_PUBLIC_KEY?.length || 0;

		// 4. Check service worker registration
		try {
			const registration = await navigator.serviceWorker.ready;
			diagnostics['Service Worker active'] = !!registration.active;
			diagnostics['Service Worker scope'] = registration.scope;

			// 5. Check push subscription
			const subscription = await registration.pushManager.getSubscription();
			diagnostics['Has push subscription'] = !!subscription;

			if (subscription) {
				const subJson = subscription.toJSON();
				diagnostics['Subscription endpoint'] = subJson.endpoint?.substring(0, 50) + '...';
				diagnostics['Subscription has keys'] = !!(subJson.keys?.p256dh && subJson.keys?.auth);

				// Check if endpoint is Apple's push service
				diagnostics['Is Apple Push'] = subJson.endpoint?.includes('apple') || subJson.endpoint?.includes('push.apple.com') || false;
				diagnostics['Is FCM'] = subJson.endpoint?.includes('fcm.googleapis.com') || false;
				diagnostics['Is Mozilla'] = subJson.endpoint?.includes('mozilla') || false;

				subscriptionDetails = JSON.stringify(subJson, null, 2);
			}
		} catch (error) {
			diagnostics['Service Worker error'] = (error as Error).message;
		}

		// 6. Check database subscription
		try {
			const { data: subs, error } = await supabase
				.from('push_subscriptions')
				.select('id, endpoint, created_at')
				.eq('user_id', profile.id);

			if (error) {
				diagnostics['DB subscription error'] = error.message;
			} else {
				diagnostics['DB subscriptions count'] = subs?.length || 0;
				if (subs && subs.length > 0) {
					diagnostics['DB subscription endpoint'] = subs[0].endpoint.substring(0, 50) + '...';
					diagnostics['DB subscription created'] = subs[0].created_at || 'unknown';
				}
			}
		} catch (error) {
			diagnostics['DB query error'] = (error as Error).message;
		}

		// 7. Check iOS specific
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
		const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
			(window.navigator as Navigator & { standalone?: boolean }).standalone === true;

		diagnostics['Is iOS device'] = isIOS;
		diagnostics['Is standalone PWA'] = isStandalone;
		diagnostics['User Agent'] = navigator.userAgent.substring(0, 80);

		loading = false;
	}

	async function sendTestPush() {
		loading = true;
		testResult = 'Sending test push...\n';

		try {
			// Refresh the session to get a fresh token
			testResult += 'Refreshing session...\n';
			const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

			if (refreshError) {
				testResult += `Refresh error: ${refreshError.message}\n`;
				// Fall back to existing session
			}

			const session = refreshData?.session || (await supabase.auth.getSession()).data.session;

			if (!session) {
				testResult = 'Error: No active session';
				loading = false;
				return;
			}

			testResult += `Token expires: ${new Date(session.expires_at! * 1000).toLocaleString()}\n`;
			testResult += 'Calling send-push...\n';

			const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session.access_token}`,
					'apikey': PUBLIC_SUPABASE_ANON_KEY
				},
				body: JSON.stringify({
					user_id: profile.id,
					title: 'Test Push Notification',
					message: `Test sent at ${new Date().toLocaleTimeString()}`,
					url: '/courier/settings?tab=debug'
				})
			});

			const result = await response.json();
			testResult += `\nResponse (${response.status}): ${JSON.stringify(result, null, 2)}`;
		} catch (error) {
			testResult += `\nError: ${(error as Error).message}`;
		}

		loading = false;
	}

	async function showLocalNotification() {
		try {
			const registration = await navigator.serviceWorker.ready;
			await registration.showNotification('Local Test Notification', {
				body: 'This is a local notification (not from server)',
				icon: '/pwa-192x192.png',
				badge: '/pwa-64x64.png',
				tag: 'local-test'
			} as NotificationOptions);
			testResult = 'Local notification triggered - check if it appears!';
		} catch (error) {
			testResult = `Local notification error: ${(error as Error).message}`;
		}
	}

	// Run diagnostics on mount
	onMount(() => {
		runDiagnostics();
	});
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>System Check</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="space-y-2 font-mono text-sm">
			{#each Object.entries(diagnostics) as [key, value] (key)}
				<div class="flex justify-between border-b py-1 gap-2">
					<span class="text-muted-foreground text-xs">{key}:</span>
					<span class="text-xs text-right {value === true ? 'text-green-500' : value === false ? 'text-red-500' : ''}">
						{String(value)}
					</span>
				</div>
			{/each}
		</div>
		<Button onclick={runDiagnostics} disabled={loading} class="mt-4" size="sm">
			{loading ? 'Running...' : 'Re-run Diagnostics'}
		</Button>
	</Card.Content>
</Card.Root>

{#if subscriptionDetails}
	<Card.Root>
		<Card.Header>
			<Card.Title>Subscription Details</Card.Title>
		</Card.Header>
		<Card.Content>
			<pre class="text-xs bg-muted p-3 rounded overflow-auto max-h-48">{subscriptionDetails}</pre>
		</Card.Content>
	</Card.Root>
{/if}

<Card.Root>
	<Card.Header>
		<Card.Title>Test Notifications</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class="flex flex-col sm:flex-row gap-2">
			<Button onclick={showLocalNotification} disabled={loading} variant="outline" size="sm">
				Test Local
			</Button>
			<Button onclick={sendTestPush} disabled={loading} size="sm">
				Send Server Push
			</Button>
		</div>
		{#if testResult}
			<pre class="text-xs bg-muted p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">{testResult}</pre>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root>
	<Card.Header>
		<Card.Title>Debugging Tips</Card.Title>
	</Card.Header>
	<Card.Content class="text-sm space-y-2">
		<p><strong>Local works, server doesn't?</strong> → Issue with subscription or server.</p>
		<p><strong>Neither works?</strong> → Check iOS Settings → bareCourier → Notifications.</p>
		<p><strong>DB count is 0?</strong> → Re-enable push in Notifications tab.</p>
	</Card.Content>
</Card.Root>
