<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import {
		ArrowLeft,
		Edit,
		MoreVertical,
		MapPin,
		Phone,
		User,
		Package,
		CheckCircle,
		Clock,
		UserX,
		UserCheck
	} from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	let showArchiveDialog = $state(false);
	let loading = $state(false);
	let actionError = $state('');

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	async function handleToggleActive() {
		loading = true;
		actionError = '';

		try {
			const response = await fetch(`?/toggleActive`, { method: 'POST' });

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await invalidateAll();
					showArchiveDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to update client status';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}

	const client = $derived(data.client);
	const services = $derived(data.services);
	const stats = $derived(data.stats);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Button variant="ghost" size="sm" href={localizeHref('/courier/clients')}>
				<ArrowLeft class="size-4" />
			</Button>
			<h1 class="text-2xl font-bold">{client.name}</h1>
			{#if !client.active}
				<Badge variant="secondary" class="bg-muted">{m.clients_inactive()}</Badge>
			{/if}
		</div>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" size="sm" {...props}>
						<MoreVertical class="size-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onclick={() => goto(localizeHref(`/courier/clients/${client.id}/edit`))}>
					<Edit class="mr-2 size-4" />
					{m.action_edit()}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={() => (showArchiveDialog = true)}>
					{#if client.active}
						<UserX class="mr-2 size-4" />
						{m.clients_deactivate()}
					{:else}
						<UserCheck class="mr-2 size-4" />
						{m.clients_reactivate()}
					{/if}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-3 gap-4">
		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<Package class="size-8 text-muted-foreground" />
				<div>
					<p class="text-2xl font-bold">{stats.total}</p>
					<p class="text-sm text-muted-foreground">{m.stats_total()}</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<Clock class="size-8 text-blue-500" />
				<div>
					<p class="text-2xl font-bold">{stats.pending}</p>
					<p class="text-sm text-muted-foreground">{m.status_pending()}</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<CheckCircle class="size-8 text-green-500" />
				<div>
					<p class="text-2xl font-bold">{stats.delivered}</p>
					<p class="text-sm text-muted-foreground">{m.status_delivered()}</p>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<Tabs.Root value="info">
		<Tabs.List>
			<Tabs.Trigger value="info">{m.tab_info()}</Tabs.Trigger>
			<Tabs.Trigger value="services">{m.tab_services()} ({services.length})</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="info" class="space-y-4 pt-4">
			<!-- Contact Info -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<User class="size-5" />
						{m.contact_info()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div>
						<p class="text-sm font-medium text-muted-foreground">{m.form_name()}</p>
						<p class="mt-1">{client.name}</p>
					</div>
					<Separator />
					<div>
						<p class="text-sm font-medium text-muted-foreground">{m.form_phone()}</p>
						{#if client.phone}
							<p class="mt-1 flex items-center gap-2">
								<Phone class="size-4" />
								{client.phone}
							</p>
						{:else}
							<p class="mt-1 text-muted-foreground">{m.clients_no_phone()}</p>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Default Location -->
			{#if client.default_pickup_location}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<MapPin class="size-5" />
							{m.default_location()}
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<p>{client.default_pickup_location}</p>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Account Info -->
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.account_info()}</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.label_status()}</span>
						<Badge variant={client.active ? 'default' : 'secondary'}>
							{client.active ? m.status_active() : m.clients_inactive()}
						</Badge>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.label_member_since()}</span>
						<span>{formatDate(client.created_at)}</span>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="services" class="pt-4">
			<div class="space-y-3">
				{#if services.length === 0}
					<Card.Root>
						<Card.Content class="py-8 text-center text-muted-foreground">
							{m.client_no_services()}
						</Card.Content>
					</Card.Root>
				{:else}
					{#each services as service (service.id)}
						<a href={localizeHref(`/courier/services/${service.id}`)} class="block">
							<Card.Root class="transition-colors hover:bg-muted/50">
								<Card.Content class="flex items-start gap-4 p-4">
									<div
										class="mt-1 size-3 shrink-0 rounded-full {service.status === 'pending'
											? 'bg-blue-500'
											: 'bg-green-500'}"
									></div>
									<div class="min-w-0 flex-1">
										<div class="flex items-center justify-between gap-2">
											<p class="text-sm text-muted-foreground truncate">
												{service.pickup_location} &rarr; {service.delivery_location}
											</p>
											<Badge
												variant="outline"
												class={service.status === 'pending'
													? 'border-blue-500 text-blue-500'
													: 'border-green-500 text-green-500'}
											>
												{service.status === 'pending' ? m.status_pending() : m.status_delivered()}
											</Badge>
										</div>
										<p class="mt-1 text-xs text-muted-foreground">
											{formatDate(service.created_at)}
											{#if service.notes}
												&middot; {service.notes}
											{/if}
										</p>
									</div>
								</Card.Content>
							</Card.Root>
						</a>
					{/each}
				{/if}
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Archive/Reactivate Confirmation Dialog -->
<AlertDialog.Root bind:open={showArchiveDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				{client.active ? m.confirm_deactivate_client() : m.confirm_reactivate_client()}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{client.active ? m.confirm_deactivate_client_desc() : m.confirm_reactivate_client_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={loading} onclick={() => (actionError = '')}>{m.action_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleToggleActive} disabled={loading}>
				{loading ? m.loading() : m.action_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
