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
