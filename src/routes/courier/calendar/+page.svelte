<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref, getLocale } from '$lib/paraglide/runtime.js';
	import { formatMonthYear, formatDateFull } from '$lib/utils.js';
	import type { PageData } from './$types';
	import type { Service, Profile } from '$lib/database.types.js';

	let { data }: { data: PageData } = $props();

	type ServiceWithClient = Service & { profiles: Pick<Profile, 'id' | 'name'> };

	// Parse current month
	const currentMonthDate = $derived(new Date(data.currentMonth + '-01'));
	const year = $derived(currentMonthDate.getFullYear());
	const month = $derived(currentMonthDate.getMonth());

	// Get days in month and first day of week
	const daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
	const firstDayOfWeek = $derived(new Date(year, month, 1).getDay());

	// Adjust for Monday start (0 = Monday, 6 = Sunday)
	const adjustedFirstDay = $derived(firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);

	// Group services by date
	const servicesByDate = $derived(
		data.services.reduce(
			(acc, service) => {
				const dateKey = service.scheduled_date || service.created_at.split('T')[0];
				if (!acc[dateKey]) {
					acc[dateKey] = [];
				}
				acc[dateKey].push(service);
				return acc;
			},
			{} as Record<string, ServiceWithClient[]>
		)
	);

	// Get services for a specific day
	function getServicesForDay(day: number): ServiceWithClient[] {
		const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		return servicesByDate[dateKey] || [];
	}

	// Navigate to previous/next month
	function goToPreviousMonth() {
		const prevMonth = new Date(year, month - 1, 1);
		const monthStr = prevMonth.toISOString().slice(0, 7);
		goto(`${page.url.pathname}?month=${monthStr}`);
	}

	function goToNextMonth() {
		const nextMonth = new Date(year, month + 1, 1);
		const monthStr = nextMonth.toISOString().slice(0, 7);
		goto(`${page.url.pathname}?month=${monthStr}`);
	}

	function goToToday() {
		const today = new Date();
		const monthStr = today.toISOString().slice(0, 7);
		goto(`${page.url.pathname}?month=${monthStr}`);
	}

	// Format month name
	const monthName = $derived(formatMonthYear(currentMonthDate));

	// Check if a day is today
	function isToday(day: number): boolean {
		const today = new Date();
		return (
			today.getFullYear() === year &&
			today.getMonth() === month &&
			today.getDate() === day
		);
	}

	// Weekday names (Monday first) - generated dynamically based on locale
	const weekdays = $derived(() => {
		const locale = getLocale();
		// Create a week starting from Monday (Jan 6, 2020 was a Monday)
		const baseDate = new Date(2020, 0, 6);
		return Array.from({ length: 7 }, (_, i) => {
			const date = new Date(baseDate);
			date.setDate(baseDate.getDate() + i);
			return date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 3);
		});
	});

	// Selected day for detail view
	let selectedDay = $state<number | null>(null);
	let selectedDayServices = $derived<ServiceWithClient[]>(
		selectedDay ? getServicesForDay(selectedDay) : []
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.calendar_title()}</h1>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={goToPreviousMonth}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m15 18-6-6 6-6" />
				</svg>
			</Button>
			<Button variant="outline" size="sm" onclick={goToToday}>Hoje</Button>
			<Button variant="outline" size="sm" onclick={goToNextMonth}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
			</Button>
		</div>
	</div>

	<div class="text-center">
		<h2 class="text-lg font-medium capitalize">{monthName}</h2>
	</div>

	<!-- Calendar Grid -->
	<Card.Root>
		<Card.Content class="p-4">
			<!-- Weekday headers -->
			<div class="grid grid-cols-7 gap-1 mb-2">
				{#each weekdays as day}
					<div class="text-center text-sm font-medium text-muted-foreground py-2">
						{day}
					</div>
				{/each}
			</div>

			<!-- Calendar days -->
			<div class="grid grid-cols-7 gap-1">
				<!-- Empty cells for days before first of month -->
				{#each Array(adjustedFirstDay) as _}
					<div class="aspect-square p-1"></div>
				{/each}

				<!-- Days of month -->
				{#each Array(daysInMonth) as _, i}
					{@const day = i + 1}
					{@const dayServices = getServicesForDay(day)}
					{@const hasServices = dayServices.length > 0}
					{@const isSelected = selectedDay === day}

					<button
						type="button"
						class="aspect-square p-1 rounded-lg transition-colors {isToday(day)
							? 'bg-primary/10 border border-primary'
							: isSelected
								? 'bg-accent'
								: 'hover:bg-accent/50'}"
						onclick={() => (selectedDay = isSelected ? null : day)}
					>
						<div class="h-full flex flex-col items-center">
							<span class="text-sm {isToday(day) ? 'font-bold text-primary' : ''}">
								{day}
							</span>
							{#if hasServices}
								<div class="flex gap-0.5 mt-1 flex-wrap justify-center">
									{#each dayServices.slice(0, 3) as service}
										<div
											class="size-2 rounded-full {service.status === 'delivered'
												? 'bg-green-500'
												: 'bg-blue-500'}"
										></div>
									{/each}
									{#if dayServices.length > 3}
										<span class="text-xs text-muted-foreground">+{dayServices.length - 3}</span>
									{/if}
								</div>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Selected day detail -->
	{#if selectedDay !== null}
		<Card.Root>
			<Card.Header>
				<Card.Title>
					{formatDateFull(new Date(year, month, selectedDay))}
				</Card.Title>
				<Card.Description>
					{m.calendar_services_count({ count: selectedDayServices.length })}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if selectedDayServices.length === 0}
					<p class="text-muted-foreground text-center py-4">{m.calendar_no_services()}</p>
				{:else}
					<div class="space-y-3">
						{#each selectedDayServices as service}
							<a
								href={localizeHref(`/courier/services/${service.id}`)}
								class="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
							>
								<div class="flex items-start justify-between gap-4">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-1">
											<span class="font-medium truncate">{service.profiles.name}</span>
											<Badge
												variant={service.status === 'delivered' ? 'default' : 'secondary'}
												class={service.status === 'delivered' ? 'bg-green-500' : 'bg-blue-500'}
											>
												{service.status === 'delivered' ? m.status_delivered() : m.status_pending()}
											</Badge>
										</div>
										<p class="text-sm text-muted-foreground truncate">
											{service.pickup_location} → {service.delivery_location}
										</p>
										{#if service.scheduled_time_slot}
											<p class="text-xs text-muted-foreground mt-1">
												{#if service.scheduled_time_slot === 'morning'}
													{m.time_slot_morning()}
												{:else if service.scheduled_time_slot === 'afternoon'}
													{m.time_slot_afternoon()}
												{:else if service.scheduled_time_slot === 'evening'}
													{m.time_slot_evening()}
												{:else if service.scheduled_time}
													{service.scheduled_time}
												{/if}
											</p>
										{/if}
									</div>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-muted-foreground"
									>
										<path d="m9 18 6-6-6-6" />
									</svg>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
