/**
 * Workload Calculation Service
 * Calculates daily workload estimates for the courier.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Service, WorkloadSettings } from '$lib/database.types.js';
import { getBreakTimeForRange } from '$lib/services/breaks.js';
import { estimateDrivingMinutes } from '$lib/services/distance.js';

export interface WorkloadEstimate {
	totalServices: number;
	totalDistanceKm: number;
	drivingTimeMinutes: number;
	serviceTimeMinutes: number;
	breakTimeMinutes: number;
	totalTimeMinutes: number;
	availableMinutes: number;
	bufferMinutes: number;
	status: 'comfortable' | 'tight' | 'overloaded';
	services: ServiceWorkloadItem[];
}

export interface ServiceWorkloadItem {
	id: string;
	clientName: string;
	pickupLocation: string;
	deliveryLocation: string;
	distanceKm: number | null;
	drivingMinutes: number | null;
	serviceMinutes: number;
	scheduledTime: string | null;
}

const DEFAULT_WORKLOAD_SETTINGS: WorkloadSettings = {
	daily_hours: 8,
	default_service_time_minutes: 15,
	auto_lunch_start: '12:00',
	auto_lunch_end: '13:00',
	review_time: '18:00',
	learning_enabled: true,
	learned_service_time_minutes: null,
	learning_sample_count: 0
};

/**
 * Get workload settings from profile, with defaults
 */
export function getWorkloadSettings(profileSettings: unknown): WorkloadSettings {
	if (!profileSettings || typeof profileSettings !== 'object') {
		return DEFAULT_WORKLOAD_SETTINGS;
	}
	return { ...DEFAULT_WORKLOAD_SETTINGS, ...(profileSettings as Partial<WorkloadSettings>) };
}

/**
 * Get effective service time (learned or default)
 */
export function getEffectiveServiceTime(settings: WorkloadSettings): number {
	if (settings.learning_enabled && settings.learned_service_time_minutes !== null) {
		return settings.learned_service_time_minutes;
	}
	return settings.default_service_time_minutes;
}

/**
 * Calculate workload for a specific date
 */
export async function calculateDayWorkload(
	supabase: SupabaseClient,
	courierId: string,
	date: Date,
	settings: WorkloadSettings
): Promise<WorkloadEstimate> {
	// Get start and end of day
	const startOfDay = new Date(date);
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date(date);
	endOfDay.setHours(23, 59, 59, 999);

	const dateStr = date.toISOString().split('T')[0];

	// Fetch services and break time in parallel (independent operations)
	const [servicesResult, breakTimeMinutes] = await Promise.all([
		supabase
			.from('services')
			.select('*, profiles!client_id(name)')
			.eq('scheduled_date', dateStr)
			.eq('status', 'pending')
			.is('deleted_at', null)
			.order('scheduled_time_slot'),
		getBreakTimeForRange(supabase, courierId, startOfDay, endOfDay)
	]);

	const services = (servicesResult.data || []) as (Service & { profiles: { name: string } | null })[];

	// Calculate effective service time
	const serviceTimePerStop = getEffectiveServiceTime(settings);

	// Build service items and sum totals
	let totalDistanceKm = 0;
	let totalDrivingMinutes = 0;

	const serviceItems: ServiceWorkloadItem[] = services.map((s) => {
		const distanceKm = s.distance_km ?? null;
		// Use stored duration from API, fallback to estimate from distance
		const drivingMinutes = s.duration_minutes ?? (distanceKm ? estimateDrivingMinutes(distanceKm) : null);

		if (distanceKm) totalDistanceKm += distanceKm;
		if (drivingMinutes) totalDrivingMinutes += drivingMinutes;

		return {
			id: s.id,
			clientName: s.profiles?.name || 'Unknown',
			pickupLocation: s.pickup_location,
			deliveryLocation: s.delivery_location,
			distanceKm,
			drivingMinutes,
			serviceMinutes: serviceTimePerStop,
			scheduledTime: s.scheduled_time || null
		};
	});

	const serviceTimeMinutes = services.length * serviceTimePerStop;
	const totalTimeMinutes = totalDrivingMinutes + serviceTimeMinutes + breakTimeMinutes;
	const availableMinutes = settings.daily_hours * 60;
	const bufferMinutes = availableMinutes - totalTimeMinutes;

	let status: 'comfortable' | 'tight' | 'overloaded';
	if (bufferMinutes < 0) {
		status = 'overloaded';
	} else if (bufferMinutes < 60) {
		status = 'tight';
	} else {
		status = 'comfortable';
	}

	return {
		totalServices: services.length,
		totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
		drivingTimeMinutes: totalDrivingMinutes,
		serviceTimeMinutes,
		breakTimeMinutes,
		totalTimeMinutes,
		availableMinutes,
		bufferMinutes,
		status,
		services: serviceItems
	};
}
