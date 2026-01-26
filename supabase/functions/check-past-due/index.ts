import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Time slot cutoffs
const TIME_SLOT_CUTOFFS: Record<string, string> = {
	morning: '12:00',
	afternoon: '17:00',
	evening: '21:00'
};

interface Service {
	id: string;
	client_id: string;
	scheduled_date: string;
	scheduled_time_slot: string | null;
	scheduled_time: string | null;
	status: string;
	profiles: { name: string } | null;
}

interface PastDueSettings {
	gracePeriodStandard?: number;
	gracePeriodSpecific?: number;
	pastDueReminderInterval?: number;
}

interface CourierProfile {
	id: string;
	past_due_settings: PastDueSettings | null;
}

// Track last notification time per service to prevent spam
const notificationCache: Map<string, number> = new Map();

function getCutoffTime(service: Service, gracePeriod: number): Date | null {
	if (!service.scheduled_date) return null;

	const date = new Date(service.scheduled_date + 'T00:00:00');

	if (service.scheduled_time_slot === 'specific' && service.scheduled_time) {
		const [hours, minutes] = service.scheduled_time.split(':').map(Number);
		date.setHours(hours, minutes, 0, 0);
	} else if (service.scheduled_time_slot && TIME_SLOT_CUTOFFS[service.scheduled_time_slot]) {
		const [hours, minutes] = TIME_SLOT_CUTOFFS[service.scheduled_time_slot].split(':').map(Number);
		date.setHours(hours, minutes, 0, 0);
	} else {
		// Default to end of day
		date.setHours(17, 0, 0, 0);
	}

	// Add grace period
	return new Date(date.getTime() + gracePeriod * 60 * 1000);
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
			.select('id, past_due_settings')
			.eq('role', 'courier')
			.single();

		const courier = courierData as CourierProfile | null;
		if (!courier) {
			return new Response(JSON.stringify({ error: 'Courier not found' }), {
				status: 404,
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

		// Get pending services scheduled for today or earlier
		const todayStr = now.toISOString().split('T')[0];
		const { data: services } = await supabase
			.from('services')
			.select(
				'id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status, profiles!client_id(name)'
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

			const cutoff = getCutoffTime(service, gracePeriod);
			if (!cutoff) continue;

			if (now > cutoff) {
				const overdueMinutes = (now.getTime() - cutoff.getTime()) / (1000 * 60);

				// Check if we've notified recently
				const lastNotified = notificationCache.get(service.id) || 0;
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
			await supabase.from('notifications').insert({
				user_id: courier.id,
				type: 'service_status',
				title: 'Entrega Atrasada',
				message: `Entrega de ${clientName} está ${overdueText} atrasada`,
				service_id: service.id
			});

			// Update cache
			notificationCache.set(service.id, now.getTime());
			notifiedCount++;
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
