/**
 * Past Due Detection Utilities
 *
 * Calculates urgency levels for services based on scheduled times and cutoffs.
 */

export type UrgencyLevel = 'on_track' | 'approaching' | 'urgent' | 'past_due' | 'critical';

export type TimeSlotConfig = {
	morning: { start: string; end: string };
	afternoon: { start: string; end: string };
	evening: { start: string; end: string };
};

export type PastDueConfig = {
	timeSlots: TimeSlotConfig;
	gracePeriodStandard: number; // minutes
	gracePeriodSpecific: number; // minutes
	thresholdApproaching: number; // minutes before cutoff
	thresholdUrgent: number; // minutes before cutoff
	thresholdCriticalHours: number; // hours after past due
};

export const DEFAULT_CONFIG: PastDueConfig = {
	timeSlots: {
		morning: { start: '08:00', end: '12:00' },
		afternoon: { start: '12:00', end: '17:00' },
		evening: { start: '17:00', end: '21:00' }
	},
	gracePeriodStandard: 30,
	gracePeriodSpecific: 15,
	thresholdApproaching: 120, // 2 hours
	thresholdUrgent: 60, // 1 hour
	thresholdCriticalHours: 24
};

export type ServiceForUrgency = {
	status: string;
	scheduled_date: string | null;
	scheduled_time_slot: string | null;
	scheduled_time: string | null;
};

/**
 * Calculate the urgency level of a service based on its scheduled time.
 */
export function calculateUrgency(
	service: ServiceForUrgency,
	config: PastDueConfig = DEFAULT_CONFIG,
	now: Date = new Date()
): UrgencyLevel {
	// Delivered services have no urgency
	if (service.status === 'delivered') return 'on_track';

	// Unscheduled services can't be past due
	if (!service.scheduled_date) return 'on_track';

	// Calculate cutoff time
	const cutoff = getCutoffTime(service, config);
	if (!cutoff) return 'on_track';

	// Add grace period
	const graceMinutes =
		service.scheduled_time_slot === 'specific'
			? config.gracePeriodSpecific
			: config.gracePeriodStandard;
	const deadline = new Date(cutoff.getTime() + graceMinutes * 60000);

	// Calculate difference in minutes
	const diffMinutes = (deadline.getTime() - now.getTime()) / 60000;

	// Determine urgency level
	if (diffMinutes < -(config.thresholdCriticalHours * 60)) return 'critical';
	if (diffMinutes < 0) return 'past_due';
	if (diffMinutes < config.thresholdUrgent) return 'urgent';
	if (diffMinutes < config.thresholdApproaching) return 'approaching';
	return 'on_track';
}

/**
 * Get the cutoff time for a service based on its scheduled date and time slot.
 */
function getCutoffTime(
	service: {
		scheduled_date: string | null;
		scheduled_time_slot: string | null;
		scheduled_time: string | null;
	},
	config: PastDueConfig
): Date | null {
	if (!service.scheduled_date) return null;

	const date = new Date(service.scheduled_date + 'T00:00:00');

	if (service.scheduled_time_slot === 'specific' && service.scheduled_time) {
		const [hours, minutes] = service.scheduled_time.split(':').map(Number);
		date.setHours(hours, minutes, 0, 0);
		return date;
	}

	const slot = service.scheduled_time_slot as keyof TimeSlotConfig | null;
	if (slot && config.timeSlots[slot]) {
		const [hours, minutes] = config.timeSlots[slot].end.split(':').map(Number);
		date.setHours(hours, minutes, 0, 0);
		return date;
	}

	// Default to end of business day if no slot specified
	date.setHours(17, 0, 0, 0);
	return date;
}

/**
 * Check if a service is past due.
 */
export function isPastDue(
	service: ServiceForUrgency,
	config: PastDueConfig = DEFAULT_CONFIG,
	now: Date = new Date()
): boolean {
	const urgency = calculateUrgency(service, config, now);
	return urgency === 'past_due' || urgency === 'critical';
}

/**
 * Get human-readable time remaining or overdue text.
 */
export function getTimeRemaining(
	service: ServiceForUrgency,
	config: PastDueConfig = DEFAULT_CONFIG,
	now: Date = new Date()
): string | null {
	if (service.status === 'delivered') return null;
	if (!service.scheduled_date) return null;

	const cutoff = getCutoffTime(service, config);
	if (!cutoff) return null;

	const graceMinutes =
		service.scheduled_time_slot === 'specific'
			? config.gracePeriodSpecific
			: config.gracePeriodStandard;
	const deadline = new Date(cutoff.getTime() + graceMinutes * 60000);

	const diffMinutes = Math.round((deadline.getTime() - now.getTime()) / 60000);

	if (diffMinutes < 0) {
		const overdue = Math.abs(diffMinutes);
		if (overdue >= 60) {
			const hours = Math.floor(overdue / 60);
			return `${hours}h overdue`;
		}
		return `${overdue}m overdue`;
	}

	if (diffMinutes < 60) {
		return `${diffMinutes}m left`;
	}

	const hours = Math.floor(diffMinutes / 60);
	const mins = diffMinutes % 60;
	if (mins > 0) {
		return `${hours}h ${mins}m left`;
	}
	return `${hours}h left`;
}

/**
 * Sort services by urgency, with most urgent first.
 */
export function sortByUrgency<T extends ServiceForUrgency>(
	services: T[],
	config: PastDueConfig = DEFAULT_CONFIG
): T[] {
	const priority: Record<UrgencyLevel, number> = {
		critical: 0,
		past_due: 1,
		urgent: 2,
		approaching: 3,
		on_track: 4
	};

	return [...services].sort((a, b) => {
		const urgencyA = calculateUrgency(a, config);
		const urgencyB = calculateUrgency(b, config);

		if (priority[urgencyA] !== priority[urgencyB]) {
			return priority[urgencyA] - priority[urgencyB];
		}

		// Secondary sort by scheduled time (earlier first)
		const timeA = a.scheduled_date || '';
		const timeB = b.scheduled_date || '';
		return timeA.localeCompare(timeB);
	});
}

/**
 * Convert database PastDueSettings to PastDueConfig for calculations.
 * Merges user settings with defaults, preserving timeSlots from defaults.
 */
export function settingsToConfig(
	settings: {
		gracePeriodStandard?: number;
		gracePeriodSpecific?: number;
		thresholdApproaching?: number;
		thresholdUrgent?: number;
		thresholdCriticalHours?: number;
	} | null
): PastDueConfig {
	if (!settings) return DEFAULT_CONFIG;

	return {
		timeSlots: DEFAULT_CONFIG.timeSlots, // Time slots are not user-configurable
		gracePeriodStandard: settings.gracePeriodStandard ?? DEFAULT_CONFIG.gracePeriodStandard,
		gracePeriodSpecific: settings.gracePeriodSpecific ?? DEFAULT_CONFIG.gracePeriodSpecific,
		thresholdApproaching: settings.thresholdApproaching ?? DEFAULT_CONFIG.thresholdApproaching,
		thresholdUrgent: settings.thresholdUrgent ?? DEFAULT_CONFIG.thresholdUrgent,
		thresholdCriticalHours: settings.thresholdCriticalHours ?? DEFAULT_CONFIG.thresholdCriticalHours
	};
}
