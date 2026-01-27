<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Bell, Globe, Clock } from '@lucide/svelte';
	import type { Profile, PastDueSettings, NotificationPreferences } from '$lib/database.types.js';
	import { DEFAULT_PAST_DUE_SETTINGS, DEFAULT_NOTIFICATION_PREFERENCES } from '$lib/constants/scheduling.js';
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

	// Use shared defaults from constants
	const defaultPastDueSettings = DEFAULT_PAST_DUE_SETTINGS;

	// Notification preferences state
	let pushEnabled = $state(false);
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let emailEnabled = $state(profile.email_notifications_enabled ?? true);
	let pushLoading = $state(false);
	let pushError = $state('');
	let pushSupported = $state(false);

	// Past due settings for automated notifications
	// Merge defaults with existing settings to handle partial data from older records
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let pastDueSettings = $state<PastDueSettings>({
		...defaultPastDueSettings,
		...(profile.past_due_settings ?? {})
	});

	// Notification preferences state (merge defaults with existing)
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let notificationPrefs = $state<NotificationPreferences>({
		...DEFAULT_NOTIFICATION_PREFERENCES,
		...((profile.notification_preferences as NotificationPreferences | null) ?? {}),
		categories: {
			...DEFAULT_NOTIFICATION_PREFERENCES.categories,
			...((profile.notification_preferences as NotificationPreferences | null)?.categories ?? {})
		},
		quietHours: {
			...DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
			...((profile.notification_preferences as NotificationPreferences | null)?.quietHours ?? {})
		}
	});

	function updateCategoryPref(
		category: keyof NotificationPreferences['categories'],
		channel: 'inApp' | 'push' | 'email',
		value: boolean
	) {
		notificationPrefs.categories[category][channel] = value;
	}

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

{#snippet categoryRow(category: keyof typeof notificationPrefs.categories, titleMsg: () => string, descMsg: () => string)}
	<div class="grid grid-cols-4 gap-4 items-center">
		<div>
			<p class="text-sm font-medium">{titleMsg()}</p>
			<p class="text-xs text-muted-foreground">{descMsg()}</p>
		</div>
		<div class="flex justify-center">
			<Checkbox checked={notificationPrefs.categories[category].inApp} disabled />
		</div>
		<div class="flex justify-center">
			<Checkbox
				checked={notificationPrefs.categories[category].push}
				onCheckedChange={(v) => updateCategoryPref(category, 'push', v === true)}
				disabled={!pushSupported || !pushEnabled}
			/>
		</div>
		<div class="flex justify-center">
			<Checkbox
				checked={notificationPrefs.categories[category].email}
				onCheckedChange={(v) => updateCategoryPref(category, 'email', v === true)}
				disabled={!emailEnabled}
			/>
		</div>
	</div>
{/snippet}

<!-- Notification Preferences & Quiet Hours (single form) -->
<form method="POST" action="?/updateNotificationPreferences" use:enhance class="space-y-6">
	<input type="hidden" name="notification_preferences" value={JSON.stringify(notificationPrefs)} />

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Bell class="size-5" />
			{m.settings_notification_preferences()}
		</Card.Title>
		<Card.Description>{m.settings_notification_preferences_desc()}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
			<!-- Header row -->
			<div class="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
				<div></div>
				<div class="text-center">{m.settings_channel_in_app()}</div>
				<div class="text-center">{m.settings_channel_push()}</div>
				<div class="text-center">{m.settings_channel_email()}</div>
			</div>

			{@render categoryRow('new_request', m.settings_category_new_request, m.settings_category_new_request_desc)}
			{@render categoryRow('schedule_change', m.settings_category_schedule_change, m.settings_category_schedule_change_desc)}
			{@render categoryRow('past_due', m.settings_category_past_due, m.settings_category_past_due_desc)}
			{@render categoryRow('daily_summary', m.settings_category_daily_summary, m.settings_category_daily_summary_desc)}
			{@render categoryRow('service_status', m.settings_category_service_status, m.settings_category_service_status_desc)}

	</Card.Content>
</Card.Root>

<!-- Quiet Hours -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Clock class="size-5" />
			{m.settings_quiet_hours()}
		</Card.Title>
		<Card.Description>{m.settings_quiet_hours_desc()}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
			<!-- Enable toggle -->
			<div class="flex items-center justify-between">
				<Label>{m.settings_quiet_hours_enabled()}</Label>
				<Switch
					checked={notificationPrefs.quietHours.enabled}
					onCheckedChange={(checked) => {
						notificationPrefs = {
							...notificationPrefs,
							quietHours: { ...notificationPrefs.quietHours, enabled: checked }
						};
					}}
				/>
			</div>

			{#if notificationPrefs.quietHours.enabled}
				<div class="flex items-center gap-4">
					<div class="space-y-1">
						<Label>{m.settings_quiet_hours_from()}</Label>
						<Input
							type="time"
							lang={getLocale()}
							value={notificationPrefs.quietHours.start}
							onchange={(e) => {
								notificationPrefs = {
									...notificationPrefs,
									quietHours: { ...notificationPrefs.quietHours, start: (e.currentTarget as HTMLInputElement).value }
								};
							}}
							class="w-28"
						/>
					</div>
					<div class="space-y-1">
						<Label>{m.settings_quiet_hours_to()}</Label>
						<Input
							type="time"
							lang={getLocale()}
							value={notificationPrefs.quietHours.end}
							onchange={(e) => {
								notificationPrefs = {
									...notificationPrefs,
									quietHours: { ...notificationPrefs.quietHours, end: (e.currentTarget as HTMLInputElement).value }
								};
							}}
							class="w-28"
						/>
					</div>
				</div>
			{/if}

			<Separator />

			<!-- Working days only -->
			<div class="flex items-center justify-between">
				<div>
					<Label>{m.settings_working_days_only()}</Label>
					<p class="text-xs text-muted-foreground">{m.settings_working_days_only_desc()}</p>
				</div>
				<Switch
					checked={notificationPrefs.workingDaysOnly}
					onCheckedChange={(checked) => {
						notificationPrefs = { ...notificationPrefs, workingDaysOnly: checked };
					}}
				/>
			</div>

	</Card.Content>
</Card.Root>

	<Button type="submit">{m.action_save()}</Button>
</form>

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
							lang={getLocale()}
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
