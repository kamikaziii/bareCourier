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
	import type { Service } from '$lib/database.types.js';

	let { data }: { data: PageData } = $props();

	type CalendarService = Pick<Service, 'id' | 'pickup_location' | 'delivery_location' | 'status' | 'scheduled_date' | 'created_at' | 'request_status' | 'scheduled_time_slot' | 'scheduled_time'>;

	// Parse current month
	const currentMonthDate = $derived(new Date(data.currentMonth + '-01'));
	const year = $derived(currentMonthDate.getFullYear());
	const month = $derived(currentMonthDate.getMonth());

	// Get days in month and first day of week
	const daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
	const firstDayOfWeek = $derived(new Date(year, month, 1).getDay());

	// Adjust for Monday start (0 = Monday, 6 = Sunday)
	const adjustedFirstDay = $derived(firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);

	// Calculate previous month info for leading days
	const prevMonthDays = $derived(new Date(year, month, 0).getDate());

	// Build 42-cell grid (6 weeks) with prev/next month days
	type CalendarCell = {
		day: number;
		month: 'prev' | 'current' | 'next';
		year: number;
		monthNum: number;
	};

	const calendarCells = $derived.by<CalendarCell[]>(() => {
		const cells: CalendarCell[] = [];

		// Previous month days
		for (let i = adjustedFirstDay - 1; i >= 0; i--) {
			const prevMonth = month === 0 ? 11 : month - 1;
			const prevYear = month === 0 ? year - 1 : year;
			cells.push({
				day: prevMonthDays - i,
				month: 'prev',
				year: prevYear,
				monthNum: prevMonth
			});
		}

		// Current month days
		for (let day = 1; day <= daysInMonth; day++) {
			cells.push({
				day,
				month: 'current',
				year,
				monthNum: month
			});
		}

		// Next month days to fill 42 cells
		const remaining = 42 - cells.length;
		for (let day = 1; day <= remaining; day++) {
			const nextMonth = month === 11 ? 0 : month + 1;
			const nextYear = month === 11 ? year + 1 : year;
			cells.push({
				day,
				month: 'next',
				year: nextYear,
				monthNum: nextMonth
			});
		}

		return cells;
	});

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
			{} as Record<string, CalendarService[]>
		)
	);

	// Get services for a specific date
	function getServicesForDate(
		cellYear: number,
		cellMonth: number,
		day: number
	): CalendarService[] {
		const dateKey = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		return servicesByDate[dateKey] || [];
	}

	// Get services for current month day (for selected day panel)
	function getServicesForDay(day: number): CalendarService[] {
		return getServicesForDate(year, month, day);
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

	// Check if a cell is today
	function isCellToday(cell: CalendarCell): boolean {
		const today = new Date();
		return (
			today.getFullYear() === cell.year &&
			today.getMonth() === cell.monthNum &&
			today.getDate() === cell.day
		);
	}

	// Weekday names (Monday first) - generated dynamically based on locale
	const weekdays = $derived.by(() => {
		const locale = getLocale();
		const baseDate = new Date(2020, 0, 6); // Monday
		return Array.from({ length: 7 }, (_, i) => {
			const date = new Date(baseDate);
			date.setDate(baseDate.getDate() + i);
			return date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 3);
		});
	});

	// Selected day for detail view
	let selectedDay = $state<number | null>(null);
	let selectedDayServices = $derived<CalendarService[]>(
		selectedDay ? getServicesForDay(selectedDay) : []
	);
</script>

<div class="space-y-4">
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
			<Button variant="outline" size="sm" onclick={goToToday}>{m.calendar_today()}</Button>
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

	<!-- Desktop: Side-by-side layout | Mobile/Tablet: Stacked -->
	<div class="grid gap-4 lg:grid-cols-[1fr_360px]">
		<!-- Calendar Grid -->
		<Card.Root>
			<Card.Content class="p-3 sm:p-4">
				<!-- Weekday headers -->
				<div class="grid grid-cols-7 gap-px mb-1">
					{#each weekdays as day}
						<div class="text-center text-xs sm:text-sm font-medium text-muted-foreground py-1 sm:py-2">
							{day}
						</div>
					{/each}
				</div>

				<!-- Calendar days - fixed 6 rows (42 cells) -->
				<div class="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden" style="min-height: 384px;">
					{#each calendarCells as cell, index (index)}
						{@const cellServices = getServicesForDate(cell.year, cell.monthNum, cell.day)}
						{@const hasServices = cellServices.length > 0}
						{@const isSelected = selectedDay === cell.day && cell.month === 'current'}
						{@const isCurrentMonth = cell.month === 'current'}
						{@const isToday = isCellToday(cell)}

						<button
							type="button"
							class="bg-background p-1 sm:p-2 transition-colors flex flex-col min-h-[64px] sm:min-h-[72px]
								{isToday ? 'bg-primary/10 ring-1 ring-inset ring-primary' : ''}
								{isSelected ? 'bg-accent' : ''}
								{!isToday && !isSelected ? 'hover:bg-accent/50' : ''}
								{!isCurrentMonth ? 'opacity-40' : ''}"
							onclick={() => {
								if (isCurrentMonth) {
									selectedDay = isSelected ? null : cell.day;
								}
							}}
							disabled={!isCurrentMonth}
						>
							<span
								class="text-xs sm:text-sm leading-none
									{isToday ? 'font-bold text-primary' : ''}
									{!isCurrentMonth ? 'text-muted-foreground' : ''}"
							>
								{cell.day}
							</span>
							<!-- Service indicators -->
							<div class="flex-1 flex items-start justify-center pt-1">
								<div class="flex gap-0.5 flex-wrap justify-center max-h-5 overflow-hidden">
									{#if hasServices}
										{#if cellServices.length <= 3}
											{#each cellServices as service}
												<div
													class="size-1.5 sm:size-2 rounded-full {service.status === 'delivered'
														? 'bg-green-500'
														: 'bg-blue-500'}"
												></div>
											{/each}
										{:else}
											<span class="text-[10px] sm:text-xs font-medium text-muted-foreground">
												{cellServices.length}
											</span>
										{/if}
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Day Detail Panel -->
		<Card.Root class="lg:h-fit lg:sticky lg:top-20">
			<Card.Header class="pb-3">
				{#if selectedDay !== null}
					<Card.Title class="text-lg">
						{formatDateFull(new Date(year, month, selectedDay))}
					</Card.Title>
					<Card.Description>
						{m.calendar_services_count({ count: selectedDayServices.length })}
					</Card.Description>
				{:else}
					<Card.Title class="text-lg text-muted-foreground">
						{m.calendar_view_day()}
					</Card.Title>
					<Card.Description>
						{m.calendar_no_services()}
					</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content class="pt-0">
				{#if selectedDay === null}
					<p class="text-muted-foreground text-center py-8 text-sm">
						{m.calendar_no_services()}
					</p>
				{:else if selectedDayServices.length === 0}
					<p class="text-muted-foreground text-center py-8 text-sm">{m.calendar_no_services()}</p>
				{:else}
					<div class="space-y-2 max-h-[400px] overflow-y-auto">
						{#each selectedDayServices as service}
							<a
								href={localizeHref(`/client/services/${service.id}`)}
								class="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
							>
								<div class="flex items-start justify-between gap-3">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-1">
											<Badge
												variant={service.status === 'delivered' ? 'default' : 'secondary'}
												class="text-xs {service.status === 'delivered' ? 'bg-green-500' : 'bg-blue-500'}"
											>
												{service.status === 'delivered' ? m.status_delivered() : m.status_pending()}
											</Badge>
										</div>
										<p class="text-xs text-muted-foreground truncate">
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
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-muted-foreground shrink-0 mt-0.5"
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
	</div>
</div>
