<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import type { TimeSlot } from '$lib/database.types.js';
	import {
		CalendarDate,
		DateFormatter,
		getLocalTimeZone,
		parseDate,
		today,
		type DateValue
	} from '@internationalized/date';

	interface Props {
		selectedDate: string | null;
		selectedTimeSlot: TimeSlot | null;
		selectedTime: string | null;
		onDateChange: (date: string | null) => void;
		onTimeSlotChange: (slot: TimeSlot | null) => void;
		onTimeChange: (time: string | null) => void;
		disabled?: boolean;
	}

	let {
		selectedDate,
		selectedTimeSlot,
		selectedTime,
		onDateChange,
		onTimeSlotChange,
		onTimeChange,
		disabled = false
	}: Props = $props();

	// Use a function to get the DateFormatter with current locale
	const getDateFormatter = () =>
		new DateFormatter(getLocale(), {
			dateStyle: 'long'
		});

	// Use a derived value for calendar that syncs with selectedDate prop
	// svelte-ignore state_referenced_locally - intentional: initial value from prop, synced via $effect below
	let calendarValue = $state<DateValue | undefined>(
		selectedDate ? parseDate(selectedDate) : undefined
	);

	// Sync calendarValue when selectedDate changes externally
	$effect(() => {
		if (selectedDate) {
			calendarValue = parseDate(selectedDate);
		} else {
			calendarValue = undefined;
		}
	});

	let popoverOpen = $state(false);

	const timeSlots: { value: TimeSlot; label: () => string }[] = [
		{ value: 'morning', label: () => m.time_slot_morning() },
		{ value: 'afternoon', label: () => m.time_slot_afternoon() },
		{ value: 'evening', label: () => m.time_slot_evening() },
		{ value: 'specific', label: () => m.time_slot_specific() }
	];

	function handleDateSelect(date: DateValue | undefined) {
		calendarValue = date;
		if (date) {
			onDateChange(date.toString());
		} else {
			onDateChange(null);
		}
		popoverOpen = false;
	}

	function handleTimeSlotClick(slot: TimeSlot) {
		if (selectedTimeSlot === slot) {
			onTimeSlotChange(null);
			if (slot === 'specific') {
				onTimeChange(null);
			}
		} else {
			onTimeSlotChange(slot);
			if (slot !== 'specific') {
				onTimeChange(null);
			}
		}
	}

	function clearDate() {
		calendarValue = undefined;
		onDateChange(null);
	}

	const displayDate = $derived(
		calendarValue
			? getDateFormatter().format(calendarValue.toDate(getLocalTimeZone()))
			: m.schedule_select_date()
	);
</script>

<div class="space-y-4">
	<div class="space-y-2">
		<Label>{m.schedule_date()}</Label>
		<Popover.Root bind:open={popoverOpen}>
			<Popover.Trigger {disabled}>
				<Button
					variant="outline"
					class="w-full justify-start text-left font-normal {!calendarValue
						? 'text-muted-foreground'
						: ''}"
					{disabled}
				>
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
						class="mr-2"
					>
						<rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
						<line x1="16" x2="16" y1="2" y2="6" />
						<line x1="8" x2="8" y1="2" y2="6" />
						<line x1="3" x2="21" y1="10" y2="10" />
					</svg>
					{displayDate}
				</Button>
			</Popover.Trigger>
			<Popover.Content class="w-auto p-0" align="start">
				<Calendar
					type="single"
					bind:value={calendarValue}
					onValueChange={handleDateSelect}
					minValue={today(getLocalTimeZone())}
					locale={getLocale()}
				/>
				{#if calendarValue}
					<div class="border-t p-2">
						<Button variant="ghost" size="sm" class="w-full" onclick={clearDate}>
							Limpar data
						</Button>
					</div>
				{/if}
			</Popover.Content>
		</Popover.Root>
	</div>

	<div class="space-y-2">
		<Label>{m.schedule_time_slot()}</Label>
		<div class="grid grid-cols-2 gap-2">
			{#each timeSlots as slot}
				<Button
					type="button"
					variant={selectedTimeSlot === slot.value ? 'default' : 'outline'}
					size="sm"
					class="w-full"
					onclick={() => handleTimeSlotClick(slot.value)}
					{disabled}
				>
					{slot.label()}
				</Button>
			{/each}
		</div>
	</div>

	{#if selectedTimeSlot === 'specific'}
		<div class="space-y-2">
			<Label for="specific-time">{m.schedule_time()}</Label>
			<Input
				id="specific-time"
				type="time"
				value={selectedTime || ''}
				oninput={(e) => onTimeChange(e.currentTarget.value || null)}
				{disabled}
			/>
		</div>
	{/if}
</div>
