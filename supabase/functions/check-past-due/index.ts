import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Default time slot cutoffs (used if no custom time slots are defined)
const DEFAULT_SLOT_CUTOFFS: Record<string, string> = {
	morning: '12:00',
	afternoon: '17:00',
	evening: '21:00'
};

interface TimeSlotConfig {
	start: string;
	end: string;
}

interface TimeSlots {
	morning: TimeSlotConfig;
	afternoon: TimeSlotConfig;
	evening: TimeSlotConfig;
}

interface Service {
	id: string;
	client_id: string;
	scheduled_date: string;
	scheduled_time_slot: string | null;
	scheduled_time: string | null;
	status: string;
	profiles: { name: string } | null;
	last_past_due_notification_at: string | null;
}

interface PastDueSettings {
	gracePeriodStandard?: number;
	gracePeriodSpecific?: number;
	pastDueReminderInterval?: number;
}

interface CourierProfile {
	id: string;
	past_due_settings: PastDueSettings | null;
	time_slots: TimeSlots | null;
	working_days: string[] | null;
	timezone: string | null;
}

// Note: Edge Functions are STATELESS - no in-memory caching
// We use the database column `last_past_due_notification_at` for deduplication

// Get time slot end time from custom settings or defaults
function getSlotCutoff(slot: string, timeSlots: TimeSlots | null): string {
	if (timeSlots && timeSlots[slot as keyof TimeSlots]) {
		return timeSlots[slot as keyof TimeSlots].end;
	}
	return DEFAULT_SLOT_CUTOFFS[slot] || '17:00';
}

function getCutoffTime(
	service: Service,
	gracePeriod: number,
	timeSlots: TimeSlots | null,
	timezone: string
): Date | null {
	if (!service.scheduled_date) return null;

	// Determine the cutoff time string (HH:MM)
	let cutoffTimeStr: string;
	if (service.scheduled_time_slot === 'specific' && service.scheduled_time) {
		cutoffTimeStr = service.scheduled_time;
	} else if (service.scheduled_time_slot) {
		cutoffTimeStr = getSlotCutoff(service.scheduled_time_slot, timeSlots);
	} else {
		cutoffTimeStr = '17:00';
	}

	// Create ISO string for the local datetime
	const localDateTimeStr = `${service.scheduled_date}T${cutoffTimeStr}:00`;

	// Parse the local datetime and convert to UTC
	// We need to find out what UTC time corresponds to this local time
	const localDate = new Date(localDateTimeStr);

	// Get the timezone offset by comparing UTC and local representations
	// This handles DST automatically
	const utcStr = localDate.toLocaleString('en-US', { timeZone: 'UTC' });
	const tzStr = localDate.toLocaleString('en-US', { timeZone: timezone });
	const utcDate = new Date(utcStr);
	const tzDate = new Date(tzStr);
	const offsetMs = utcDate.getTime() - tzDate.getTime();

	// Apply offset to get the correct UTC time
	const cutoffUtc = new Date(localDate.getTime() + offsetMs);

	// Add grace period
	return new Date(cutoffUtc.getTime() + gracePeriod * 60 * 1000);
}

function formatOverdueTime(minutes: number): string {
	if (minutes < 60) {
		return `${Math.round(minutes)} minutos`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours} hora${hours > 1 ? 's' : ''}`;
	}
	const days = Math.floor(hours / 24);
	return `${days} dia${days > 1 ? 's' : ''}`;
}

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	try {
		const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
		const now = new Date();

		// Get courier profile with settings
		const { data: courierData } = await supabase
			.from('profiles')
			.select('id, past_due_settings, time_slots, working_days, timezone')
			.eq('role', 'courier')
			.single();

		const courier = courierData as CourierProfile | null;
		if (!courier) {
			return new Response(JSON.stringify({ error: 'Courier not found' }), {
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Check if today is a working day (in courier's timezone)
		const courierTimezone = courier.timezone || 'Europe/Lisbon';
		const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
		const localDate = new Date(now.toLocaleString('en-US', { timeZone: courierTimezone }));
		const todayName = dayNames[localDate.getDay()];
		const workingDays = courier.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

		if (!workingDays.includes(todayName)) {
			return new Response(JSON.stringify({ message: 'Not a working day', notified: 0 }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const settings = courier.past_due_settings || {};
		const reminderInterval = settings.pastDueReminderInterval ?? 60;

		// If reminders disabled, exit
		if (reminderInterval === 0) {
			return new Response(JSON.stringify({ message: 'Reminders disabled', notified: 0 }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const gracePeriodStandard = settings.gracePeriodStandard ?? 30;
		const gracePeriodSpecific = settings.gracePeriodSpecific ?? 15;

		// Get custom time slots from courier profile
		const timeSlots = courier.time_slots || null;

		// Get pending services scheduled for today or earlier (use local date)
		const todayStr = localDate.toISOString().split('T')[0];
		const { data: services } = await supabase
			.from('services')
			.select(
				'id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status, last_past_due_notification_at, profiles!client_id(name)'
			)
			.eq('status', 'pending')
			.lte('scheduled_date', todayStr)
			.is('deleted_at', null);

		if (!services || services.length === 0) {
			return new Response(JSON.stringify({ message: 'No pending services', notified: 0 }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const pastDueServices: { service: Service; overdueMinutes: number }[] = [];

		for (const service of services as Service[]) {
			const gracePeriod =
				service.scheduled_time_slot === 'specific' ? gracePeriodSpecific : gracePeriodStandard;

			const cutoff = getCutoffTime(service, gracePeriod, timeSlots, courierTimezone);
			if (!cutoff) continue;

			if (now > cutoff) {
				const overdueMinutes = (now.getTime() - cutoff.getTime()) / (1000 * 60);

				// Check if we've notified recently using database timestamp
				const lastNotified = service.last_past_due_notification_at
					? new Date(service.last_past_due_notification_at).getTime()
					: 0;
				const minutesSinceLastNotification = (now.getTime() - lastNotified) / (1000 * 60);

				if (minutesSinceLastNotification >= reminderInterval) {
					pastDueServices.push({ service, overdueMinutes });
				}
			}
		}

		// Send notifications for past due services
		let notifiedCount = 0;

		for (const { service, overdueMinutes } of pastDueServices) {
			const clientName = service.profiles?.name || 'Cliente';
			const overdueText = formatOverdueTime(overdueMinutes);

			// Create in-app notification for courier
			const { error: notifError } = await supabase.from('notifications').insert({
				user_id: courier.id,
				type: 'service_status',
				title: 'Entrega Atrasada',
				message: `Entrega de ${clientName} está ${overdueText} atrasada`,
				service_id: service.id
			});

			if (!notifError) {
				// Persist notification timestamp to database for deduplication
				await supabase
					.from('services')
					.update({ last_past_due_notification_at: now.toISOString() })
					.eq('id', service.id);

				notifiedCount++;
			}
		}

		return new Response(
			JSON.stringify({
				message: 'Past due check complete',
				checked: services.length,
				pastDue: pastDueServices.length,
				notified: notifiedCount
			}),
			{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		console.error('Error:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}
});
