/**
 * Break Management Service
 * Handles starting, ending, and querying breaks for the courier.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CurrentBreak {
	id: string;
	startedAt: Date;
	type: 'lunch' | 'manual';
	elapsedMinutes: number;
}

/**
 * Get the courier's current active break (if any)
 */
export async function getCurrentBreak(
	supabase: SupabaseClient,
	courierId: string
): Promise<CurrentBreak | null> {
	const { data, error } = await supabase
		.from('break_logs')
		.select('*')
		.eq('courier_id', courierId)
		.is('ended_at', null)
		.order('started_at', { ascending: false })
		.limit(1)
		.single();

	if (error || !data) return null;

	const startedAt = new Date(data.started_at);
	const elapsedMinutes = Math.floor((Date.now() - startedAt.getTime()) / 60000);

	return {
		id: data.id,
		startedAt,
		type: data.type as 'lunch' | 'manual',
		elapsedMinutes
	};
}

/**
 * Start a new break
 */
export async function startBreak(
	supabase: SupabaseClient,
	courierId: string,
	type: 'lunch' | 'manual',
	source: 'auto' | 'toggle' = 'toggle'
): Promise<{ success: boolean; error?: string }> {
	// Check if already on break
	const current = await getCurrentBreak(supabase, courierId);
	if (current) {
		return { success: false, error: 'Already on break' };
	}

	const { error } = await supabase.from('break_logs').insert({
		courier_id: courierId,
		started_at: new Date().toISOString(),
		type,
		source
	});

	if (error) {
		// Handle unique constraint violation (race condition: another break started concurrently)
		if (error.code === '23505' && error.message.includes('idx_break_logs_active_break')) {
			return { success: false, error: 'Already on break' };
		}
		return { success: false, error: error.message };
	}

	return { success: true };
}

/**
 * End the current break
 */
export async function endBreak(
	supabase: SupabaseClient,
	courierId: string
): Promise<{ success: boolean; durationMinutes?: number; error?: string }> {
	const current = await getCurrentBreak(supabase, courierId);
	if (!current) {
		return { success: false, error: 'Not on break' };
	}

	const endedAt = new Date();
	const { error } = await supabase
		.from('break_logs')
		.update({ ended_at: endedAt.toISOString() })
		.eq('id', current.id);

	if (error) {
		return { success: false, error: error.message };
	}

	return { success: true, durationMinutes: current.elapsedMinutes };
}

/**
 * Log a retroactive break (from anomaly prompt or daily review)
 */
export async function logRetroactiveBreak(
	supabase: SupabaseClient,
	courierId: string,
	startedAt: Date,
	endedAt: Date,
	source: 'anomaly_prompt' | 'daily_review'
): Promise<{ success: boolean; error?: string }> {
	const { error } = await supabase.from('break_logs').insert({
		courier_id: courierId,
		started_at: startedAt.toISOString(),
		ended_at: endedAt.toISOString(),
		type: 'retroactive',
		source
	});

	if (error) {
		// Handle overlap constraint violation
		if (error.code === '23P01' && error.message.includes('no_overlapping_breaks')) {
			return { success: false, error: 'This break overlaps with an existing break' };
		}
		return { success: false, error: error.message };
	}

	return { success: true };
}

/**
 * Get total break time for a date range
 */
export async function getBreakTimeForRange(
	supabase: SupabaseClient,
	courierId: string,
	startDate: Date,
	endDate: Date
): Promise<number> {
	const { data, error } = await supabase
		.from('break_logs')
		.select('started_at, ended_at')
		.eq('courier_id', courierId)
		.gte('started_at', startDate.toISOString())
		.lte('started_at', endDate.toISOString())
		.not('ended_at', 'is', null);

	if (error || !data) return 0;

	return data.reduce((total, log) => {
		const start = new Date(log.started_at);
		const end = new Date(log.ended_at!);
		return total + Math.floor((end.getTime() - start.getTime()) / 60000);
	}, 0);
}
