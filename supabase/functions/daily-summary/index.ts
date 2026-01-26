import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface PastDueSettings {
	dailySummaryEnabled?: boolean;
	dailySummaryTime?: string;
	thresholdUrgent?: number;
}

interface CourierProfile {
	id: string;
	past_due_settings: PastDueSettings | null;
	working_days: string[] | null;
	timezone: string | null;
}

interface Service {
	id: string;
	status: string;
	scheduled_date: string;
	scheduled_time_slot: string | null;
	scheduled_time: string | null;
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
			.select('id, past_due_settings, working_days, timezone')
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
		const courierTimezone = courier.timezone || 'Europe/Lisbon';

		// Check if daily summary is enabled
		if (settings.dailySummaryEnabled === false) {
			return new Response(JSON.stringify({ message: 'Daily summary disabled', sent: false }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Get current time in courier's timezone
		const localTime = now.toLocaleTimeString('en-GB', {
			timeZone: courierTimezone,
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});

		// Only send if within the right 15-minute window (cron runs every 15 min)
		const preferredTime = settings.dailySummaryTime || '08:00';
		const [prefHour, prefMin] = preferredTime.split(':').map(Number);
		const [localHour, localMin] = localTime.split(':').map(Number);

		if (localHour !== prefHour || Math.abs(localMin - prefMin) > 7) {
			return new Response(JSON.stringify({ message: 'Not the right time', sent: false }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Check if today is a working day (in courier's timezone)
		const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
		const localDate = new Date(now.toLocaleString('en-US', { timeZone: courierTimezone }));
		const todayName = dayNames[localDate.getDay()];
		const workingDays = courier.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

		if (!workingDays.includes(todayName)) {
			return new Response(JSON.stringify({ message: 'Not a working day', sent: false }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		// Get today's date in courier's timezone for querying services
		const todayStr = localDate.toISOString().split('T')[0];

		// Get today's services
		const { data: services } = await supabase
			.from('services')
			.select('id, status, scheduled_date, scheduled_time_slot, scheduled_time')
			.eq('scheduled_date', todayStr)
			.is('deleted_at', null);

		if (!services) {
			return new Response(JSON.stringify({ message: 'No services found' }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const typedServices = services as Service[];
		const total = typedServices.length;
		const pending = typedServices.filter((s) => s.status === 'pending').length;
		const delivered = typedServices.filter((s) => s.status === 'delivered').length;

		// Count urgent services (scheduled in next hour)
		let urgent = 0;
		const hour = now.getHours();

		for (const service of typedServices) {
			if (service.status !== 'pending') continue;

			// Simple urgent check: morning services if before noon, afternoon if after, etc.
			if (
				(service.scheduled_time_slot === 'morning' && hour >= 11) ||
				(service.scheduled_time_slot === 'afternoon' && hour >= 16) ||
				(service.scheduled_time_slot === 'evening' && hour >= 20)
			) {
				urgent++;
			}
		}

		// Create summary notification
		let message: string;
		if (total === 0) {
			message = 'Nao tem entregas agendadas para hoje.';
		} else if (pending === 0) {
			message = `Todas as ${total} entregas de hoje foram concluidas!`;
		} else {
			message = `Tem ${total} entrega${total > 1 ? 's' : ''} hoje: ${pending} pendente${pending > 1 ? 's' : ''}`;
			if (urgent > 0) {
				message += `, ${urgent} urgente${urgent > 1 ? 's' : ''}`;
			}
			message += '.';
		}

		await supabase.from('notifications').insert({
			user_id: courier.id,
			type: 'service_status',
			title: 'Resumo do Dia',
			message,
			service_id: null
		});

		return new Response(
			JSON.stringify({
				message: 'Daily summary sent',
				stats: { total, pending, delivered, urgent }
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
