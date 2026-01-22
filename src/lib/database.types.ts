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
				};
				Insert: {
					id: string;
					role: 'courier' | 'client';
					name: string;
					phone?: string | null;
					default_pickup_location?: string | null;
					active?: boolean;
					created_at?: string;
				};
				Update: {
					id?: string;
					role?: 'courier' | 'client';
					name?: string;
					phone?: string | null;
					default_pickup_location?: string | null;
					active?: boolean;
					created_at?: string;
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
		Functions: {};
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
