/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 *
 * This file is generated from the Supabase schema.
 * To regenerate, run: pnpm run types:generate
 *
 * Manual type aliases and custom types live in database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
					push_notifications_enabled: boolean;
					email_notifications_enabled: boolean;
					pricing_mode: 'warehouse' | 'zone' | null;
					warehouse_lat: number | null;
					warehouse_lng: number | null;
					show_price_to_courier: boolean | null;
					show_price_to_client: boolean | null;
					default_urgency_fee_id: string | null;
					minimum_charge: number | null;
					round_distance: boolean | null;
					past_due_settings: Json | null;
					timezone: string;
					time_slots: Json | null;
					working_days: Json | null;
					notification_preferences: Json | null;
					vat_enabled: boolean;
					vat_rate: number | null;
					prices_include_vat: boolean;
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
					past_due_settings?: Json | null;
					timezone?: string;
					time_slots?: Json | null;
					working_days?: Json | null;
					notification_preferences?: Json | null;
					vat_enabled?: boolean;
					vat_rate?: number | null;
					prices_include_vat?: boolean;
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
					past_due_settings?: Json | null;
					timezone?: string;
					time_slots?: Json | null;
					working_days?: Json | null;
					notification_preferences?: Json | null;
					vat_enabled?: boolean;
					vat_rate?: number | null;
					prices_include_vat?: boolean;
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
					suggested_time: string | null;
					pickup_lat: number | null;
					pickup_lng: number | null;
					delivery_lat: number | null;
					delivery_lng: number | null;
					distance_km: number | null;
					urgency_fee_id: string | null;
					calculated_price: number | null;
					price_breakdown: Json | null;
					price_override_reason: string | null;
					reschedule_count: number;
					last_rescheduled_at: string | null;
					last_rescheduled_by: string | null;
					pending_reschedule_date: string | null;
					pending_reschedule_time_slot: string | null;
					pending_reschedule_time: string | null;
					pending_reschedule_reason: string | null;
					pending_reschedule_requested_at: string | null;
					pending_reschedule_requested_by: string | null;
					vat_rate_snapshot: number;
					prices_include_vat_snapshot: boolean;
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
					suggested_time?: string | null;
					pickup_lat?: number | null;
					pickup_lng?: number | null;
					delivery_lat?: number | null;
					delivery_lng?: number | null;
					distance_km?: number | null;
					urgency_fee_id?: string | null;
					calculated_price?: number | null;
					price_breakdown?: Json | null;
					price_override_reason?: string | null;
					reschedule_count?: number;
					last_rescheduled_at?: string | null;
					last_rescheduled_by?: string | null;
					pending_reschedule_date?: string | null;
					pending_reschedule_time_slot?: string | null;
					pending_reschedule_time?: string | null;
					pending_reschedule_reason?: string | null;
					pending_reschedule_requested_at?: string | null;
					pending_reschedule_requested_by?: string | null;
					vat_rate_snapshot?: number;
					prices_include_vat_snapshot?: boolean;
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
					suggested_time?: string | null;
					pickup_lat?: number | null;
					pickup_lng?: number | null;
					delivery_lat?: number | null;
					delivery_lng?: number | null;
					distance_km?: number | null;
					urgency_fee_id?: string | null;
					calculated_price?: number | null;
					price_breakdown?: Json | null;
					price_override_reason?: string | null;
					reschedule_count?: number;
					last_rescheduled_at?: string | null;
					last_rescheduled_by?: string | null;
					pending_reschedule_date?: string | null;
					pending_reschedule_time_slot?: string | null;
					pending_reschedule_time?: string | null;
					pending_reschedule_reason?: string | null;
					pending_reschedule_requested_at?: string | null;
					pending_reschedule_requested_by?: string | null;
					vat_rate_snapshot?: number;
					prices_include_vat_snapshot?: boolean;
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
					type: 'service_status' | 'new_request' | 'schedule_change' | 'service_created' | 'past_due' | 'daily_summary';
					title: string;
					message: string;
					service_id: string | null;
					read: boolean;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					type: 'service_status' | 'new_request' | 'schedule_change' | 'service_created' | 'past_due' | 'daily_summary';
					title: string;
					message: string;
					service_id?: string | null;
					read?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					type?: 'service_status' | 'new_request' | 'schedule_change' | 'service_created' | 'past_due' | 'daily_summary';
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
			client_approve_reschedule: {
				Args: { p_service_id: string };
				Returns: Json;
			};
			client_deny_reschedule: {
				Args: { p_service_id: string; p_denial_reason?: string | null };
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
				Returns: Json;
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
