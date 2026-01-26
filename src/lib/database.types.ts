export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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

export type Database = {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					role: 'courier' | 'client';
					name: string;
					phone: string | null;
					default_pickup_location: string | null;
					active: boolean;
					created_at: string;
					// Notification preferences (Phase 4)
					push_notifications_enabled: boolean;
					email_notifications_enabled: boolean;
					// Pricing mode (Phase 5B)
					pricing_mode: 'warehouse' | 'zone' | null;
					// Warehouse coordinates (Phase 6)
					warehouse_lat: number | null;
					warehouse_lng: number | null;
					// Pricing settings (Phase 6)
					show_price_to_courier: boolean | null;
					show_price_to_client: boolean | null;
					default_urgency_fee_id: string | null;
					minimum_charge: number | null;
					round_distance: boolean | null;
					// Past due settings (Phase 3 Past Due)
					past_due_settings: PastDueSettings | null;
					// Scheduling settings (Settings Page Improvements)
					timezone: string;
					time_slots: TimeSlotDefinitions | null;
					working_days: WorkingDay[] | null;
				};
				Insert: {
					id: string;
					role: 'courier' | 'client';
					name: string;
					phone?: string | null;
					default_pickup_location?: string | null;
					active?: boolean;
					created_at?: string;
					push_notifications_enabled?: boolean;
					email_notifications_enabled?: boolean;
					pricing_mode?: 'warehouse' | 'zone' | null;
					warehouse_lat?: number | null;
					warehouse_lng?: number | null;
					show_price_to_courier?: boolean | null;
					show_price_to_client?: boolean | null;
					default_urgency_fee_id?: string | null;
					minimum_charge?: number | null;
					round_distance?: boolean | null;
					past_due_settings?: PastDueSettings | null;
					// Scheduling settings (Settings Page Improvements)
					timezone?: string;
					time_slots?: TimeSlotDefinitions | null;
					working_days?: WorkingDay[] | null;
				};
				Update: {
					id?: string;
					role?: 'courier' | 'client';
					name?: string;
					phone?: string | null;
					default_pickup_location?: string | null;
					active?: boolean;
					created_at?: string;
					push_notifications_enabled?: boolean;
					email_notifications_enabled?: boolean;
					pricing_mode?: 'warehouse' | 'zone' | null;
					warehouse_lat?: number | null;
					warehouse_lng?: number | null;
					show_price_to_courier?: boolean | null;
					show_price_to_client?: boolean | null;
					default_urgency_fee_id?: string | null;
					minimum_charge?: number | null;
					round_distance?: boolean | null;
					past_due_settings?: PastDueSettings | null;
					// Scheduling settings (Settings Page Improvements)
					timezone?: string;
					time_slots?: TimeSlotDefinitions | null;
					working_days?: WorkingDay[] | null;
				};
			};
			services: {
				Row: {
					id: string;
					client_id: string;
					pickup_location: string;
					delivery_location: string;
					status: 'pending' | 'delivered';
					notes: string | null;
					created_at: string;
					delivered_at: string | null;
					deleted_at: string | null;
					updated_at: string;
					// Scheduling fields (Phase 2)
					requested_date: string | null;
					requested_time_slot: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					requested_time: string | null;
					scheduled_date: string | null;
					scheduled_time_slot: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					scheduled_time: string | null;
					request_status: 'pending' | 'accepted' | 'rejected' | 'suggested';
					rejection_reason: string | null;
					suggested_date: string | null;
					suggested_time_slot: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					// Coordinates (Phase 2)
					pickup_lat: number | null;
					pickup_lng: number | null;
					delivery_lat: number | null;
					delivery_lng: number | null;
					distance_km: number | null;
					// Pricing fields (Phase 3)
					urgency_fee_id: string | null;
					calculated_price: number | null;
					price_breakdown: PriceBreakdown | null;
					price_override_reason: string | null;
					// Reschedule tracking (Phase 2 Past Due)
					reschedule_count: number;
					last_rescheduled_at: string | null;
					last_rescheduled_by: string | null;
					// Pending reschedule request (Phase 4 Past Due)
					pending_reschedule_date: string | null;
					pending_reschedule_time_slot: string | null;
					pending_reschedule_time: string | null;
					pending_reschedule_reason: string | null;
					pending_reschedule_requested_at: string | null;
					pending_reschedule_requested_by: string | null;
				};
				Insert: {
					id?: string;
					client_id: string;
					pickup_location: string;
					delivery_location: string;
					status?: 'pending' | 'delivered';
					notes?: string | null;
					created_at?: string;
					delivered_at?: string | null;
					deleted_at?: string | null;
					updated_at?: string;
					// Scheduling fields (Phase 2)
					requested_date?: string | null;
					requested_time_slot?: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					requested_time?: string | null;
					scheduled_date?: string | null;
					scheduled_time_slot?: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					scheduled_time?: string | null;
					request_status?: 'pending' | 'accepted' | 'rejected' | 'suggested';
					rejection_reason?: string | null;
					suggested_date?: string | null;
					suggested_time_slot?: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					// Coordinates (Phase 2)
					pickup_lat?: number | null;
					pickup_lng?: number | null;
					delivery_lat?: number | null;
					delivery_lng?: number | null;
					distance_km?: number | null;
					// Pricing fields (Phase 3)
					urgency_fee_id?: string | null;
					calculated_price?: number | null;
					price_breakdown?: PriceBreakdown | null;
					price_override_reason?: string | null;
					// Reschedule tracking (Phase 2 Past Due)
					reschedule_count?: number;
					last_rescheduled_at?: string | null;
					last_rescheduled_by?: string | null;
					// Pending reschedule request (Phase 4 Past Due)
					pending_reschedule_date?: string | null;
					pending_reschedule_time_slot?: string | null;
					pending_reschedule_time?: string | null;
					pending_reschedule_reason?: string | null;
					pending_reschedule_requested_at?: string | null;
					pending_reschedule_requested_by?: string | null;
				};
				Update: {
					id?: string;
					client_id?: string;
					pickup_location?: string;
					delivery_location?: string;
					status?: 'pending' | 'delivered';
					notes?: string | null;
					created_at?: string;
					delivered_at?: string | null;
					deleted_at?: string | null;
					updated_at?: string;
					// Scheduling fields (Phase 2)
					requested_date?: string | null;
					requested_time_slot?: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					requested_time?: string | null;
					scheduled_date?: string | null;
					scheduled_time_slot?: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					scheduled_time?: string | null;
					request_status?: 'pending' | 'accepted' | 'rejected' | 'suggested';
					rejection_reason?: string | null;
					suggested_date?: string | null;
					suggested_time_slot?: 'morning' | 'afternoon' | 'evening' | 'specific' | null;
					// Coordinates (Phase 2)
					pickup_lat?: number | null;
					pickup_lng?: number | null;
					delivery_lat?: number | null;
					delivery_lng?: number | null;
					distance_km?: number | null;
					// Pricing fields (Phase 3)
					urgency_fee_id?: string | null;
					calculated_price?: number | null;
					price_breakdown?: PriceBreakdown | null;
					price_override_reason?: string | null;
					// Reschedule tracking (Phase 2 Past Due)
					reschedule_count?: number;
					last_rescheduled_at?: string | null;
					last_rescheduled_by?: string | null;
					// Pending reschedule request (Phase 4 Past Due)
					pending_reschedule_date?: string | null;
					pending_reschedule_time_slot?: string | null;
					pending_reschedule_time?: string | null;
					pending_reschedule_reason?: string | null;
					pending_reschedule_requested_at?: string | null;
					pending_reschedule_requested_by?: string | null;
				};
			};
			service_status_history: {
				Row: {
					id: string;
					service_id: string;
					old_status: string | null;
					new_status: string;
					changed_by: string | null;
					changed_at: string;
					notes: string | null;
				};
				Insert: {
					id?: string;
					service_id: string;
					old_status?: string | null;
					new_status: string;
					changed_by?: string | null;
					changed_at?: string;
					notes?: string | null;
				};
				Update: {
					id?: string;
					service_id?: string;
					old_status?: string | null;
					new_status?: string;
					changed_by?: string | null;
					changed_at?: string;
					notes?: string | null;
				};
			};
			notifications: {
				Row: {
					id: string;
					user_id: string;
					type: 'service_status' | 'new_request' | 'schedule_change' | 'service_created';
					title: string;
					message: string;
					service_id: string | null;
					read: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					type: 'service_status' | 'new_request' | 'schedule_change' | 'service_created';
					title: string;
					message: string;
					service_id?: string | null;
					read?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					type?: 'service_status' | 'new_request' | 'schedule_change' | 'service_created';
					title?: string;
					message?: string;
					service_id?: string | null;
					read?: boolean;
					created_at?: string;
				};
			};
			push_subscriptions: {
				Row: {
					id: string;
					user_id: string;
					endpoint: string;
					p256dh: string;
					auth: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					endpoint: string;
					p256dh: string;
					auth: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					endpoint?: string;
					p256dh?: string;
					auth?: string;
					created_at?: string;
				};
			};
			// Phase 3: Billing tables
			client_pricing: {
				Row: {
					id: string;
					client_id: string;
					pricing_model: 'per_km' | 'zone' | 'flat_plus_km';
					base_fee: number;
					per_km_rate: number;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					client_id: string;
					pricing_model?: 'per_km' | 'zone' | 'flat_plus_km';
					base_fee?: number;
					per_km_rate?: number;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					client_id?: string;
					pricing_model?: 'per_km' | 'zone' | 'flat_plus_km';
					base_fee?: number;
					per_km_rate?: number;
					created_at?: string;
					updated_at?: string;
				};
			};
			pricing_zones: {
				Row: {
					id: string;
					client_id: string;
					min_km: number;
					max_km: number | null;
					price: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					client_id: string;
					min_km?: number;
					max_km?: number | null;
					price: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					client_id?: string;
					min_km?: number;
					max_km?: number | null;
					price?: number;
					created_at?: string;
				};
			};
			urgency_fees: {
				Row: {
					id: string;
					name: string;
					description: string | null;
					multiplier: number;
					flat_fee: number;
					active: boolean;
					sort_order: number;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					description?: string | null;
					multiplier?: number;
					flat_fee?: number;
					active?: boolean;
					sort_order?: number;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					description?: string | null;
					multiplier?: number;
					flat_fee?: number;
					active?: boolean;
					sort_order?: number;
					created_at?: string;
				};
			};
		};
		Views: {};
		Functions: {
			approve_reschedule: {
				Args: { p_service_id: string; p_approved_by: string };
				Returns: Json;
			};
			deny_reschedule: {
				Args: { p_service_id: string; p_denied_by: string; p_denial_reason?: string | null };
				Returns: Json;
			};
			bulk_recalculate_service_prices: {
				Args: {
					p_client_id: string;
					p_minimum_charge?: number;
					p_service_ids: string[];
				};
				Returns: Json;
			};
			bulk_reschedule_services: {
				Args: {
					p_new_date: string;
					p_new_time?: string;
					p_new_time_slot: string;
					p_reason?: string;
					p_service_ids: string[];
					p_user_id?: string;
				};
				Returns: Json;
			};
			calculate_service_price: {
				Args: {
					p_client_id: string;
					p_distance_km: number;
					p_urgency_fee_id?: string;
				};
				Returns: {
					price_breakdown: Json;
					total_price: number;
				}[];
			};
			is_courier: { Args: Record<string, never>; Returns: boolean };
			replace_pricing_zones: {
				Args: { p_client_id: string; p_zones: Json };
				Returns: Json; // Changed from void to jsonb with {success, error?}
			};
			reschedule_service: {
				Args: {
					p_new_date: string;
					p_new_time?: string;
					p_new_time_slot: string;
					p_notification_message?: string;
					p_notification_title?: string;
					p_reason?: string;
					p_service_id: string;
				};
				Returns: Json;
			};
		};
		Enums: {};
	};
};

// Helper types
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
