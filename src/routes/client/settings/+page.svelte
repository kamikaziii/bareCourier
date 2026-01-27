<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import { Settings, User, MapPin } from '@lucide/svelte';
	import NotificationsTab from '$lib/components/NotificationsTab.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const activeTab = $derived(page.url.searchParams.get('tab') || 'profile');

	function setTab(tab: string) {
		const url = new URL(page.url);
		if (tab === 'profile') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', tab);
		}
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
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

	<!-- Desktop: Tabs -->
	<div class="hidden md:block">
		<Tabs.Root value={activeTab} onValueChange={setTab} class="w-full">
			<Tabs.List class="grid w-full grid-cols-3">
				<Tabs.Trigger value="profile">{m.settings_profile()}</Tabs.Trigger>
				<Tabs.Trigger value="location">{m.settings_default_location()}</Tabs.Trigger>
				<Tabs.Trigger value="notifications">{m.settings_tab_notifications()}</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="profile" class="mt-6 space-y-6">
				{@render profileContent()}
			</Tabs.Content>

			<Tabs.Content value="location" class="mt-6 space-y-6">
				{@render locationContent()}
			</Tabs.Content>

			<Tabs.Content value="notifications" class="mt-6 space-y-6">
				<NotificationsTab profile={data.profile} supabase={data.supabase} role="client" />
			</Tabs.Content>
		</Tabs.Root>
	</div>

	<!-- Mobile: Dropdown -->
	<div class="md:hidden space-y-6">
		<select
			value={activeTab}
			onchange={(e) => setTab(e.currentTarget.value)}
			class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
		>
			<option value="profile">{m.settings_profile()}</option>
			<option value="location">{m.settings_default_location()}</option>
			<option value="notifications">{m.settings_tab_notifications()}</option>
		</select>

		{#if activeTab === 'profile'}
			{@render profileContent()}
		{:else if activeTab === 'location'}
			{@render locationContent()}
		{:else if activeTab === 'notifications'}
			<NotificationsTab profile={data.profile} supabase={data.supabase} role="client" />
		{/if}
	</div>
</div>

{#snippet profileContent()}
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
{/snippet}

{#snippet locationContent()}
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
{/snippet}
