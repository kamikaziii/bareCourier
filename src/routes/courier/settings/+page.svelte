<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import { Settings, User, Zap, Plus, Trash2, Power, Bell, MapPin, Warehouse } from '@lucide/svelte';
	import {
		isPushSupported,
		subscribeToPush,
		unsubscribeFromPush,
		isSubscribedToPush
	} from '$lib/services/push';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// State for urgency fees
	let showNewUrgencyForm = $state(false);
	let newUrgency = $state({ name: '', description: '', multiplier: '1.0', flat_fee: '0' });

	// Editable urgency fees state
	let editingFeeId = $state<string | null>(null);

	// Delete confirmation state
	let deletingFeeId = $state<string | null>(null);
	let deleteDialogOpen = $state(false);

	// Notification preferences state
	let pushEnabled = $state(false);
	let emailEnabled = $state(data.profile.email_notifications_enabled ?? true);
	let pushLoading = $state(false);
	let pushError = $state('');
	let pushSupported = $state(false);

	// Pricing mode state
	let pricingMode = $state<'warehouse' | 'zone'>(data.profile.pricing_mode ?? 'warehouse');

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

	function openDeleteDialog(feeId: string) {
		deletingFeeId = feeId;
		deleteDialogOpen = true;
	}

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
			{#if form.error === 'urgency_in_use'}
				{m.settings_urgency_in_use()}
			{:else}
				{form.error}
			{/if}
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

	<Separator />

	<!-- Pricing Mode Settings -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<MapPin class="size-5" />
				{m.settings_pricing_mode()}
			</Card.Title>
			<Card.Description>{m.settings_pricing_mode_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/updatePricingMode" use:enhance class="space-y-4">
				<div class="space-y-3">
					<!-- Warehouse Option -->
					<label
						class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode === 'warehouse' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}"
					>
						<input
							type="radio"
							name="pricing_mode"
							value="warehouse"
							checked={pricingMode === 'warehouse'}
							onchange={() => pricingMode = 'warehouse'}
							class="mt-1"
						/>
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<Warehouse class="size-4" />
								<span class="font-medium">{m.pricing_mode_warehouse()}</span>
							</div>
							<p class="mt-1 text-sm text-muted-foreground">
								{m.pricing_mode_warehouse_desc()}
							</p>
						</div>
					</label>

					<!-- Zone Option -->
					<label
						class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode === 'zone' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}"
					>
						<input
							type="radio"
							name="pricing_mode"
							value="zone"
							checked={pricingMode === 'zone'}
							onchange={() => pricingMode = 'zone'}
							class="mt-1"
						/>
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<MapPin class="size-4" />
								<span class="font-medium">{m.pricing_mode_zone()}</span>
							</div>
							<p class="mt-1 text-sm text-muted-foreground">
								{m.pricing_mode_zone_desc()}
							</p>
						</div>
					</label>
				</div>
				<Button type="submit">{m.action_save()}</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<Separator />

	<!-- Urgency Fees -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<div>
					<Card.Title class="flex items-center gap-2">
						<Zap class="size-5" />
						{m.settings_urgency_fees()}
					</Card.Title>
					<Card.Description>{m.settings_urgency_fees_desc()}</Card.Description>
				</div>
				<Button variant="outline" onclick={() => (showNewUrgencyForm = !showNewUrgencyForm)}>
					<Plus class="mr-2 size-4" />
					{m.settings_add_urgency()}
				</Button>
			</div>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if showNewUrgencyForm}
				<form method="POST" action="?/createUrgencyFee" use:enhance class="space-y-4 rounded-lg border p-4">
					<h4 class="font-medium">{m.settings_new_urgency()}</h4>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="new_name">{m.form_name()}</Label>
							<Input id="new_name" name="name" bind:value={newUrgency.name} required />
						</div>
						<div class="space-y-2">
							<Label for="new_desc">{m.settings_description()}</Label>
							<Input id="new_desc" name="description" bind:value={newUrgency.description} />
						</div>
						<div class="space-y-2">
							<Label for="new_mult">{m.settings_multiplier()}</Label>
							<Input
								id="new_mult"
								name="multiplier"
								type="number"
								step="0.01"
								min="1"
								bind:value={newUrgency.multiplier}
							/>
							<p class="text-xs text-muted-foreground">{m.settings_multiplier_hint()}</p>
						</div>
						<div class="space-y-2">
							<Label for="new_flat">{m.settings_flat_fee()}</Label>
							<Input
								id="new_flat"
								name="flat_fee"
								type="number"
								step="0.01"
								min="0"
								bind:value={newUrgency.flat_fee}
							/>
						</div>
					</div>
					<div class="flex gap-2">
						<Button type="submit">{m.action_save()}</Button>
						<Button type="button" variant="outline" onclick={() => (showNewUrgencyForm = false)}>
							{m.action_cancel()}
						</Button>
					</div>
				</form>
			{/if}

			<div class="space-y-3">
				{#each data.urgencyFees as fee (fee.id)}
					<div class="rounded-lg border p-4 {fee.active ? '' : 'opacity-60'}">
						{#if editingFeeId === fee.id}
							<form method="POST" action="?/updateUrgencyFee" use:enhance>
								<input type="hidden" name="id" value={fee.id} />
								<input type="hidden" name="active" value={fee.active.toString()} />
								<div class="grid gap-4 md:grid-cols-4">
									<div class="space-y-2">
										<Label>{m.form_name()}</Label>
										<Input name="name" value={fee.name} required />
									</div>
									<div class="space-y-2">
										<Label>{m.settings_description()}</Label>
										<Input name="description" value={fee.description || ''} />
									</div>
									<div class="space-y-2">
										<Label>{m.settings_multiplier()}</Label>
										<Input name="multiplier" type="number" step="0.01" min="1" value={fee.multiplier} />
									</div>
									<div class="space-y-2">
										<Label>{m.settings_flat_fee()}</Label>
										<Input name="flat_fee" type="number" step="0.01" min="0" value={fee.flat_fee} />
									</div>
								</div>
								<div class="mt-4 flex gap-2">
									<Button type="submit" size="sm">{m.action_save()}</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onclick={() => (editingFeeId = null)}
									>
										{m.action_cancel()}
									</Button>
								</div>
							</form>
						{:else}
							<div class="flex items-center justify-between">
								<div>
									<h4 class="font-medium">{fee.name}</h4>
									<p class="text-sm text-muted-foreground">{fee.description || '-'}</p>
								</div>
								<div class="flex items-center gap-2">
									<div class="mr-2 text-right">
										<p class="text-sm font-medium">{fee.multiplier}x + {fee.flat_fee.toFixed(2)}€</p>
										<p class="text-xs text-muted-foreground">
											{fee.active ? m.status_active() : m.settings_inactive()}
										</p>
									</div>
									<!-- Toggle active/inactive -->
									<form method="POST" action="?/toggleUrgencyFee" use:enhance>
										<input type="hidden" name="id" value={fee.id} />
										<input type="hidden" name="active" value={fee.active.toString()} />
										<Button
											type="submit"
											variant="ghost"
											size="icon"
											title={fee.active ? m.settings_deactivate() : m.settings_activate()}
										>
											<Power class="size-4 {fee.active ? 'text-green-500' : 'text-muted-foreground'}" />
										</Button>
									</form>
									<!-- Edit -->
									<Button variant="ghost" size="icon" onclick={() => (editingFeeId = fee.id)}>
										<span class="sr-only">{m.action_edit()}</span>
										<svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
									</Button>
									<!-- Delete -->
									<Button
										variant="ghost"
										size="icon"
										class="text-destructive hover:text-destructive"
										onclick={() => openDeleteDialog(fee.id)}
									>
										<Trash2 class="size-4" />
									</Button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.settings_delete_urgency()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.settings_delete_urgency_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (deleteDialogOpen = false)}>
				{m.action_cancel()}
			</AlertDialog.Cancel>
			<form method="POST" action="?/deleteUrgencyFee" use:enhance class="inline">
				<input type="hidden" name="id" value={deletingFeeId} />
				<AlertDialog.Action type="submit" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
					{m.action_delete()}
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
