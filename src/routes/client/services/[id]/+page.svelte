<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import { ArrowLeft, MapPin, Clock, Calendar } from '@lucide/svelte';

	const hasMapbox = !!PUBLIC_MAPBOX_TOKEN;

	let { data }: { data: PageData } = $props();

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatDateTime(dateStr: string): string {
		return new Date(dateStr).toLocaleString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatTimeSlot(slot: string | null): string {
		if (!slot) return '';
		switch (slot) {
			case 'morning':
				return m.time_slot_morning();
			case 'afternoon':
				return m.time_slot_afternoon();
			case 'evening':
				return m.time_slot_evening();
			case 'specific':
				return m.time_slot_specific();
			default:
				return slot;
		}
	}

	const service = $derived(data.service);
	const statusHistory = $derived(data.statusHistory);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" href={localizeHref('/client')}>
			<ArrowLeft class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold">{m.service_details()}</h1>
	</div>

	<!-- Status Badge -->
	<Card.Root>
		<Card.Content class="flex items-center justify-between p-4">
			<div class="flex items-center gap-3">
				<Badge
					variant={service.status === 'pending' ? 'default' : 'secondary'}
					class={service.status === 'pending'
						? 'bg-blue-500 hover:bg-blue-500/80'
						: 'bg-green-500 hover:bg-green-500/80 text-white'}
				>
					{service.status === 'pending' ? m.status_pending() : m.status_delivered()}
				</Badge>
				<span class="text-sm text-muted-foreground">
					{m.created_at({ date: formatDate(service.created_at) })}
				</span>
			</div>
		</Card.Content>
	</Card.Root>

	<Tabs.Root value="details">
		<Tabs.List>
			<Tabs.Trigger value="details">{m.tab_details()}</Tabs.Trigger>
			<Tabs.Trigger value="history">{m.tab_history()}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="details" class="space-y-4 pt-4">
			<!-- Locations -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<MapPin class="size-5" />
						{m.locations()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div>
						<p class="text-sm font-medium text-muted-foreground">{m.form_pickup_location()}</p>
						<p class="mt-1">{service.pickup_location}</p>
					</div>
					<Separator />
					<div>
						<p class="text-sm font-medium text-muted-foreground">{m.form_delivery_location()}</p>
						<p class="mt-1">{service.delivery_location}</p>
					</div>

					<!-- Route Map -->
					{#if hasMapbox && service.pickup_lat && service.pickup_lng && service.delivery_lat && service.delivery_lng}
						<Separator />
						<RouteMap
							pickupCoords={[service.pickup_lng, service.pickup_lat]}
							deliveryCoords={[service.delivery_lng, service.delivery_lat]}
							distanceKm={service.distance_km}
							height="250px"
						/>
					{:else if service.distance_km}
						<Separator />
						<p class="text-sm text-muted-foreground">
							{m.map_distance({ km: service.distance_km.toFixed(1) })}
						</p>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Scheduling Info -->
			{#if service.requested_date || service.scheduled_date}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Calendar class="size-5" />
							{m.scheduling_info()}
						</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						{#if service.requested_date}
							<div>
								<p class="text-sm font-medium text-muted-foreground">{m.client_your_request()}</p>
								<p class="mt-1">
									{formatDate(service.requested_date)}
									{#if service.requested_time_slot}
										- {formatTimeSlot(service.requested_time_slot)}
									{/if}
								</p>
							</div>
						{/if}

						{#if service.scheduled_date}
							<Separator />
							<div>
								<p class="text-sm font-medium text-muted-foreground">{m.requests_scheduled()}</p>
								<p class="mt-1 font-medium text-green-600">
									{formatDate(service.scheduled_date)}
									{#if service.scheduled_time_slot}
										- {formatTimeSlot(service.scheduled_time_slot)}
									{/if}
								</p>
							</div>
						{/if}

						{#if service.request_status === 'suggested' && service.suggested_date}
							<Separator />
							<div class="rounded-lg bg-orange-500/10 p-3">
								<p class="text-sm font-medium text-orange-600">{m.client_courier_suggests()}</p>
								<p class="mt-1">
									{formatDate(service.suggested_date)}
									{#if service.suggested_time_slot}
										- {formatTimeSlot(service.suggested_time_slot)}
									{/if}
								</p>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Notes -->
			{#if service.notes}
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.form_notes()}</Card.Title>
					</Card.Header>
					<Card.Content>
						<p class="whitespace-pre-wrap">{service.notes}</p>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Timestamps -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Clock class="size-5" />
						{m.timestamps()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.label_created()}</span>
						<span>{formatDateTime(service.created_at)}</span>
					</div>
					{#if service.delivered_at}
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.label_delivered()}</span>
							<span>{formatDateTime(service.delivered_at)}</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="history" class="pt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.status_history()}</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if statusHistory.length === 0}
						<p class="text-center text-muted-foreground py-4">{m.no_status_history()}</p>
					{:else}
						<div class="space-y-4">
							{#each statusHistory as entry (entry.id)}
								<div class="flex items-start gap-3">
									<div
										class="mt-1 size-3 rounded-full {entry.new_status === 'delivered'
											? 'bg-green-500'
											: 'bg-blue-500'}"
									></div>
									<div class="flex-1">
										<p class="text-sm">
											{#if entry.old_status}
												<span class="capitalize">{entry.old_status}</span>
												&rarr;
											{/if}
											<span class="font-medium capitalize">{entry.new_status}</span>
										</p>
										<p class="text-xs text-muted-foreground">
											{formatDateTime(entry.changed_at)}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
