<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Bell, Globe } from '@lucide/svelte';
	import type { Profile, PastDueSettings } from '$lib/database.types.js';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import {
		isPushSupported,
		subscribeToPush,
		unsubscribeFromPush,
		isSubscribedToPush
	} from '$lib/services/push';

	interface Props {
		profile: Profile;
		supabase: SupabaseClient;
	}

	let { profile, supabase }: Props = $props();

	// Default past due settings
	const defaultPastDueSettings: PastDueSettings = {
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

	// Notification preferences state
	let pushEnabled = $state(false);
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let emailEnabled = $state(profile.email_notifications_enabled ?? true);
	let pushLoading = $state(false);
	let pushError = $state('');
	let pushSupported = $state(false);

	// Past due settings for automated notifications
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let pastDueSettings = $state<PastDueSettings>(
		profile.past_due_settings ?? defaultPastDueSettings
	);

	// Timezone state
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let timezone = $state(profile.timezone || 'Europe/Lisbon');

	// Check push subscription status on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			pushSupported = isPushSupported();
			if (pushSupported) {
				isSubscribedToPush().then((subscribed) => {
					pushEnabled = subscribed;
				});
			}
		}
	});

	async function togglePushNotifications() {
		if (pushLoading) return;
		pushLoading = true;
		pushError = '';

		try {
			if (pushEnabled) {
				// Unsubscribe
				const result = await unsubscribeFromPush(supabase, profile.id);
				if (result.success) {
					pushEnabled = false;
				} else {
					pushError = result.error || 'Failed to disable push notifications';
				}
			} else {
				// Subscribe
				const result = await subscribeToPush(supabase, profile.id);
				if (result.success) {
					pushEnabled = true;
				} else {
					if (result.error?.includes('permission')) {
						pushError = m.push_permission_denied();
					} else {
						pushError = result.error || 'Failed to enable push notifications';
					}
				}
			}
		} catch (error) {
			pushError = (error as Error).message;
		} finally {
			pushLoading = false;
		}
	}
</script>

<!-- Notification Preferences -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Bell class="size-5" />
			{m.settings_notifications()}
		</Card.Title>
		<Card.Description>{m.settings_notifications_desc()}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		{#if pushError}
			<div class="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
				{pushError}
			</div>
		{/if}

		<!-- Push Notifications -->
		<div class="flex items-center justify-between">
			<div class="space-y-0.5">
				<Label class="text-base">{m.settings_push_notifications()}</Label>
				<p class="text-sm text-muted-foreground">
					{#if !pushSupported}
						{m.push_not_supported()}
					{:else}
						{m.settings_push_desc()}
					{/if}
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if pushLoading}
					<span class="text-xs text-muted-foreground">
						{pushEnabled ? m.push_disabling() : m.push_enabling()}
					</span>
				{/if}
				<Switch
					checked={pushEnabled}
					onCheckedChange={togglePushNotifications}
					disabled={!pushSupported || pushLoading}
				/>
			</div>
		</div>

		<Separator />

		<!-- Email Notifications -->
		<form method="POST" action="?/updateNotificationPreferences" use:enhance class="flex items-center justify-between">
			<div class="space-y-0.5">
				<Label class="text-base">{m.settings_email_notifications()}</Label>
				<p class="text-sm text-muted-foreground">{m.settings_email_desc()}</p>
			</div>
			<input type="hidden" name="email_notifications_enabled" value={emailEnabled.toString()} />
			<Switch
				checked={emailEnabled}
				onCheckedChange={(checked) => {
					emailEnabled = checked;
					// Auto-submit the form
					const form = document.querySelector('form[action="?/updateNotificationPreferences"]') as HTMLFormElement;
					if (form) {
						const input = form.querySelector('input[name="email_notifications_enabled"]') as HTMLInputElement;
						if (input) input.value = checked.toString();
						form.requestSubmit();
					}
				}}
			/>
		</form>
	</Card.Content>
</Card.Root>

<!-- Automated Notifications -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Bell class="size-5" />
			{m.settings_automated_notifications()}
		</Card.Title>
		<Card.Description>{m.settings_automated_notifications_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updateNotificationSettings" use:enhance class="space-y-6">
			<!-- Past Due Reminder Interval -->
			<div class="space-y-2">
				<Label for="pastDueReminderInterval">{m.settings_past_due_reminder_interval()}</Label>
				<select
					id="pastDueReminderInterval"
					name="pastDueReminderInterval"
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					value={pastDueSettings.pastDueReminderInterval}
					onchange={(e) => pastDueSettings.pastDueReminderInterval = parseInt((e.target as HTMLSelectElement).value)}
				>
					<option value="0">{m.settings_reminder_disabled()}</option>
					<option value="15">15 {m.minutes()}</option>
					<option value="30">30 {m.minutes()}</option>
					<option value="60">1 {m.hour()}</option>
					<option value="120">2 {m.hours()}</option>
				</select>
				<p class="text-xs text-muted-foreground">{m.settings_past_due_reminder_interval_desc()}</p>
			</div>

			<Separator />

			<!-- Daily Summary -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<Label>{m.settings_daily_summary()}</Label>
						<p class="text-xs text-muted-foreground">{m.settings_daily_summary_desc()}</p>
					</div>
					<input type="hidden" name="dailySummaryEnabled" value={pastDueSettings.dailySummaryEnabled.toString()} />
					<Switch
						checked={pastDueSettings.dailySummaryEnabled}
						onCheckedChange={(checked) => {
							pastDueSettings.dailySummaryEnabled = checked;
						}}
					/>
				</div>

				{#if pastDueSettings.dailySummaryEnabled}
					<div class="space-y-2">
						<Label for="dailySummaryTime">{m.settings_daily_summary_time()}</Label>
						<Input
							id="dailySummaryTime"
							name="dailySummaryTime"
							type="time"
							bind:value={pastDueSettings.dailySummaryTime}
							class="w-32"
						/>
					</div>
				{/if}
			</div>

			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>

<!-- Timezone -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Globe class="size-5" />
			{m.settings_timezone()}
		</Card.Title>
		<Card.Description>{m.settings_timezone_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updateTimezone" use:enhance class="space-y-4">
			<select
				name="timezone"
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				bind:value={timezone}
			>
				<option value="Europe/Lisbon">Europe/Lisbon (Portugal)</option>
				<option value="Europe/London">Europe/London (UK)</option>
				<option value="Europe/Paris">Europe/Paris (France)</option>
				<option value="Europe/Madrid">Europe/Madrid (Spain)</option>
				<option value="Atlantic/Azores">Atlantic/Azores</option>
				<option value="Atlantic/Madeira">Atlantic/Madeira</option>
			</select>
			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>
