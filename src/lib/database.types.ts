/**
 * Database types with custom type aliases and enriched types.
 *
 * The base Database type is auto-generated in database.generated.ts.
 * Run `pnpm run types:generate` to regenerate from the live schema.
 *
 * This file re-exports the generated Database type and adds:
 * - Custom domain types (PriceBreakdown, PastDueSettings, etc.)
 * - Convenience aliases (Profile, Service, NewService, etc.)
 * - Type overrides for JSONB columns with known shapes
 */

// Re-export the generated base types
export type { Json } from './database.generated.js';
export type { Database as GeneratedDatabase } from './database.generated.js';

import type { Database as GeneratedDatabase, Json } from './database.generated.js';

// ─── Custom domain types ────────────────────────────────────────────────────

// Phase 3: Price breakdown structure
export type PriceBreakdown = {
	base: number;
	distance: number;
	urgency: number;
	total: number;
	model: 'per_km' | 'zone' | 'flat_plus_km';
	distance_km: number;
	error?: string;
	// Distance breakdown (warehouse mode)
	distance_mode?: 'warehouse' | 'zone' | 'fallback';
	warehouse_to_pickup_km?: number;
	pickup_to_delivery_km?: number;
};

// Phase 3 Past Due: Configurable settings
export type PastDueSettings = {
	gracePeriodStandard: number; // minutes after slot end (default: 30)
	gracePeriodSpecific: number; // minutes after specific time (default: 15)
	thresholdApproaching: number; // minutes before deadline to show "approaching" (default: 120)
	thresholdUrgent: number; // minutes before deadline to show "urgent" (default: 60)
	thresholdCriticalHours: number; // hours after past due to show "critical" (default: 24)
	allowClientReschedule: boolean; // whether clients can request reschedules
	clientMinNoticeHours: number; // minimum hours notice for client reschedule
	clientMaxReschedules: number; // maximum reschedules per service
	// Phase 5: Notification settings
	pastDueReminderInterval: number; // minutes between reminders (0 = disabled, default: 60)
	dailySummaryEnabled: boolean; // whether to send daily summary (default: true)
	dailySummaryTime: string; // time to send daily summary HH:MM (default: "08:00")
};

// SYNC WARNING: These notification types (NotificationCategory, ChannelPreferences, NotificationPreferences)
// must match the definitions in supabase/functions/_shared/notify.ts
// Notification channel preferences per category
export type NotificationCategory =
	| 'new_request'
	| 'schedule_change'
	| 'past_due'
	| 'daily_summary'
	| 'service_status';

export type ChannelPreferences = {
	inApp: boolean;
	push: boolean;
	email: boolean;
};

export type NotificationPreferences = {
	categories: Record<NotificationCategory, ChannelPreferences>;
	quietHours: {
		enabled: boolean;
		start: string; // "HH:MM" format
		end: string; // "HH:MM" format
	};
	workingDaysOnly: boolean;
};

// Time slot configuration for scheduling
export type TimeSlotDefinitions = {
	morning: { start: string; end: string };
	afternoon: { start: string; end: string };
	evening: { start: string; end: string };
};

// Working days configuration
export type WorkingDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Phase 4 Past Due: Reschedule history tracking
export type ServiceRescheduleHistory = {
	id: string;
	service_id: string;
	initiated_by: string;
	initiated_by_role: 'courier' | 'client';
	old_date: string | null;
	old_time_slot: string | null;
	old_time: string | null;
	new_date: string;
	new_time_slot: string;
	new_time: string | null;
	reason: string | null;
	approval_status: 'auto_approved' | 'pending' | 'approved' | 'denied';
	approved_by: string | null;
	approved_at: string | null;
	denial_reason: string | null;
	created_at: string;
};

// ─── Enriched Database type (overrides JSONB columns with typed shapes) ─────

/**
 * The Database type used throughout the app.
 * Identical to GeneratedDatabase but with JSONB columns replaced by
 * their known TypeScript shapes (PriceBreakdown, PastDueSettings, etc.).
 */
export type Database = {
	public: {
		Tables: {
			profiles: {
				Row: Omit<
					GeneratedDatabase['public']['Tables']['profiles']['Row'],
					'past_due_settings' | 'time_slots' | 'working_days' | 'notification_preferences'
				> & {
					past_due_settings: PastDueSettings | null;
					time_slots: TimeSlotDefinitions | null;
					working_days: WorkingDay[] | null;
					notification_preferences: NotificationPreferences | null;
				};
				Insert: Omit<
					GeneratedDatabase['public']['Tables']['profiles']['Insert'],
					'past_due_settings' | 'time_slots' | 'working_days' | 'notification_preferences'
				> & {
					past_due_settings?: PastDueSettings | null;
					time_slots?: TimeSlotDefinitions | null;
					working_days?: WorkingDay[] | null;
					notification_preferences?: NotificationPreferences | null;
				};
				Update: Omit<
					GeneratedDatabase['public']['Tables']['profiles']['Update'],
					'past_due_settings' | 'time_slots' | 'working_days' | 'notification_preferences'
				> & {
					past_due_settings?: PastDueSettings | null;
					time_slots?: TimeSlotDefinitions | null;
					working_days?: WorkingDay[] | null;
					notification_preferences?: NotificationPreferences | null;
				};
			};
			services: {
				Row: Omit<
					GeneratedDatabase['public']['Tables']['services']['Row'],
					'price_breakdown'
				> & {
					price_breakdown: PriceBreakdown | null;
				};
				Insert: Omit<
					GeneratedDatabase['public']['Tables']['services']['Insert'],
					'price_breakdown'
				> & {
					price_breakdown?: PriceBreakdown | null;
				};
				Update: Omit<
					GeneratedDatabase['public']['Tables']['services']['Update'],
					'price_breakdown'
				> & {
					price_breakdown?: PriceBreakdown | null;
				};
			};
			service_status_history: GeneratedDatabase['public']['Tables']['service_status_history'];
			notifications: GeneratedDatabase['public']['Tables']['notifications'];
			push_subscriptions: GeneratedDatabase['public']['Tables']['push_subscriptions'];
			client_pricing: GeneratedDatabase['public']['Tables']['client_pricing'];
			pricing_zones: GeneratedDatabase['public']['Tables']['pricing_zones'];
			urgency_fees: GeneratedDatabase['public']['Tables']['urgency_fees'];
		};
		Views: GeneratedDatabase['public']['Views'];
		Functions: GeneratedDatabase['public']['Functions'];
		Enums: GeneratedDatabase['public']['Enums'];
	};
};

// ─── Convenience aliases ────────────────────────────────────────────────────

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Service = Database['public']['Tables']['services']['Row'];
export type NewService = Database['public']['Tables']['services']['Insert'];
export type ServiceStatusHistory = Database['public']['Tables']['service_status_history']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row'];

// Time slot type for scheduling
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'specific';

// Request status type
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'suggested';

// Phase 3: Billing types
export type ClientPricing = Database['public']['Tables']['client_pricing']['Row'];
export type PricingZone = Database['public']['Tables']['pricing_zones']['Row'];
export type UrgencyFee = Database['public']['Tables']['urgency_fees']['Row'];
export type PricingModel = 'per_km' | 'zone' | 'flat_plus_km';
