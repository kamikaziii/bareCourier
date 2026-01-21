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
