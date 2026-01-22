<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import { Settings, User, MapPin } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
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
</div>
