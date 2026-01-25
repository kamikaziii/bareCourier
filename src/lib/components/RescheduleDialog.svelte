<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { Service, TimeSlot } from '$lib/database.types.js';
	import { CalendarClock } from '@lucide/svelte';

	interface Props {
		service: Service;
		open: boolean;
		onReschedule: (data: {
			date: string;
			timeSlot: TimeSlot;
			time: string | null;
			reason: string;
		}) => Promise<void>;
	}

	let { service, open = $bindable(), onReschedule }: Props = $props();

	// Initial values from prop, synced via resetForm() in $effect when dialog opens
	// svelte-ignore state_referenced_locally
	let newDate = $state<string | null>(service.scheduled_date);
	// svelte-ignore state_referenced_locally
	let newTimeSlot = $state<TimeSlot | null>(service.scheduled_time_slot);
	// svelte-ignore state_referenced_locally
	let newTime = $state<string | null>(service.scheduled_time);
	let reason = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit() {
		if (!newDate || !newTimeSlot) return;

		loading = true;
		error = '';

		try {
			await onReschedule({
				date: newDate,
				timeSlot: newTimeSlot,
				time: newTime,
				reason
			});
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : m.reschedule_error();
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		newDate = service.scheduled_date;
		newTimeSlot = service.scheduled_time_slot;
		newTime = service.scheduled_time;
		reason = '';
		error = '';
	}

	$effect(() => {
		if (open) resetForm();
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<CalendarClock class="size-5" />
				{m.reschedule_service()}
			</Dialog.Title>
			<Dialog.Description>{m.reschedule_service_desc()}</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if error}
				<div role="alert" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<SchedulePicker
				selectedDate={newDate}
				selectedTimeSlot={newTimeSlot}
				selectedTime={newTime}
				onDateChange={(date) => (newDate = date)}
				onTimeSlotChange={(slot) => (newTimeSlot = slot)}
				onTimeChange={(time) => (newTime = time)}
			/>

			<div class="space-y-2">
				<Label for="reason">{m.reschedule_reason()}</Label>
				<Textarea
					id="reason"
					bind:value={reason}
					placeholder={m.reschedule_reason_placeholder()}
					rows={2}
				/>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={loading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleSubmit} disabled={!newDate || !newTimeSlot || loading}>
				{loading ? m.saving() : m.reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
