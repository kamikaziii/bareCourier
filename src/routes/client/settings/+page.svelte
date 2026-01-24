<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import { Settings, User, MapPin, Bell } from '@lucide/svelte';
	import {
		isPushSupported,
		subscribeToPush,
		unsubscribeFromPush,
		isSubscribedToPush
	} from '$lib/services/push';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Notification preferences state
	let pushEnabled = $state(false);
	let emailEnabled = $state(data.profile.email_notifications_enabled ?? true);
	let pushLoading = $state(false);
	let pushError = $state('');
	let pushSupported = $state(false);

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
				const result = await unsubscribeFromPush(data.supabase, data.profile.id);
				if (result.success) {
					pushEnabled = false;
				} else {
					pushError = result.error || 'Failed to disable push notifications';
				}
			} else {
				// Subscribe
				const result = await subscribeToPush(data.supabase, data.profile.id);
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

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<Settings class="size-6" />
		<h1 class="text-2xl font-bold">{m.settings_title()}</h1>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 p-3 text-destructive">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-md bg-green-500/10 p-3 text-green-600">
			{m.settings_saved()}
		</div>
	{/if}

	<!-- Profile Settings -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<User class="size-5" />
				{m.settings_profile()}
			</Card.Title>
			<Card.Description>{m.settings_profile_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="name">{m.form_name()}</Label>
						<Input id="name" name="name" value={data.profile.name} required />
					</div>
					<div class="space-y-2">
						<Label for="phone">{m.form_phone()}</Label>
						<Input id="phone" name="phone" type="tel" value={data.profile.phone || ''} />
					</div>
				</div>
				<div class="space-y-2">
					<Label>{m.auth_email()}</Label>
					<Input disabled value={data.session?.user?.email || ''} />
					<p class="text-xs text-muted-foreground">{m.settings_email_readonly()}</p>
				</div>
				<Button type="submit">{m.action_save()}</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- Default Location -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<MapPin class="size-5" />
				{m.settings_default_location()}
			</Card.Title>
			<Card.Description>{m.settings_default_location_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
				<input type="hidden" name="name" value={data.profile.name} />
				<input type="hidden" name="phone" value={data.profile.phone || ''} />
				<div class="space-y-2">
					<Label for="default_pickup_location">{m.clients_default_location()}</Label>
					<Textarea
						id="default_pickup_location"
						name="default_pickup_location"
						value={data.profile.default_pickup_location || ''}
						placeholder={m.form_pickup_placeholder()}
						rows={2}
					/>
					<p class="text-xs text-muted-foreground">{m.settings_default_location_hint()}</p>
				</div>
				<Button type="submit">{m.action_save()}</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<Separator />

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
</div>
