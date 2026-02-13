export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      break_logs: {
        Row: {
          courier_id: string
          created_at: string | null
          ended_at: string | null
          id: string
          source: string
          started_at: string
          type: string
        }
        Insert: {
          courier_id: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          source: string
          started_at: string
          type: string
        }
        Update: {
          courier_id?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          source?: string
          started_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_logs_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_logs_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_addresses: {
        Row: {
          address: string
          client_id: string
          created_at: string | null
          id: string
          label: string
          lat: number | null
          lng: number | null
        }
        Insert: {
          address: string
          client_id: string
          created_at?: string | null
          id?: string
          label: string
          lat?: number | null
          lng?: number | null
        }
        Update: {
          address?: string
          client_id?: string
          created_at?: string | null
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_addresses: {
        Row: {
          address: string
          client_id: string
          created_at: string | null
          id: string
          label: string
          lat: number | null
          lng: number | null
        }
        Insert: {
          address: string
          client_id: string
          created_at?: string | null
          id?: string
          label: string
          lat?: number | null
          lng?: number | null
        }
        Update: {
          address?: string
          client_id?: string
          created_at?: string | null
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pricing: {
        Row: {
          base_fee: number
          client_id: string
          created_at: string
          id: string
          per_km_rate: number
          pricing_model: string
          updated_at: string
        }
        Insert: {
          base_fee?: number
          client_id: string
          created_at?: string
          id?: string
          per_km_rate?: number
          pricing_model?: string
          updated_at?: string
        }
        Update: {
          base_fee?: number
          client_id?: string
          created_at?: string
          id?: string
          per_km_rate?: number
          pricing_model?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_pricing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_pricing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reviews: {
        Row: {
          completed_at: string | null
          courier_id: string
          created_at: string | null
          gaps_detected: number | null
          gaps_resolved: number | null
          id: string
          review_date: string
          total_services: number | null
          total_work_minutes: number | null
        }
        Insert: {
          completed_at?: string | null
          courier_id: string
          created_at?: string | null
          gaps_detected?: number | null
          gaps_resolved?: number | null
          id?: string
          review_date: string
          total_services?: number | null
          total_work_minutes?: number | null
        }
        Update: {
          completed_at?: string | null
          courier_id?: string
          created_at?: string | null
          gaps_detected?: number | null
          gaps_resolved?: number | null
          id?: string
          review_date?: string
          total_services?: number | null
          total_work_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reviews_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reviews_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_time_logs: {
        Row: {
          break_time_minutes: number | null
          calculated_service_time_minutes: number | null
          completed_at: string
          courier_id: string
          created_at: string | null
          delay_reason: string | null
          driving_time_minutes: number | null
          id: string
          include_in_learning: boolean | null
          service_id: string
          started_at: string
        }
        Insert: {
          break_time_minutes?: number | null
          calculated_service_time_minutes?: number | null
          completed_at: string
          courier_id: string
          created_at?: string | null
          delay_reason?: string | null
          driving_time_minutes?: number | null
          id?: string
          include_in_learning?: boolean | null
          service_id: string
          started_at: string
        }
        Update: {
          break_time_minutes?: number | null
          calculated_service_time_minutes?: number | null
          completed_at?: string
          courier_id?: string
          created_at?: string | null
          delay_reason?: string | null
          driving_time_minutes?: number | null
          id?: string
          include_in_learning?: boolean | null
          service_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_time_logs_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_time_logs_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_time_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_zones: {
        Row: {
          concelho: string
          created_at: string | null
          distrito: string
          id: string
        }
        Insert: {
          concelho: string
          created_at?: string | null
          distrito: string
          id?: string
        }
        Update: {
          concelho?: string
          created_at?: string | null
          distrito?: string
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          dismissed_at: string | null
          email_id: string | null
          email_sent_at: string | null
          email_status: string | null
          id: string
          message: string
          read: boolean | null
          service_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dismissed_at?: string | null
          email_id?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          id?: string
          message: string
          read?: boolean | null
          service_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dismissed_at?: string | null
          email_id?: string | null
          email_sent_at?: string | null
          email_status?: string | null
          id?: string
          message?: string
          read?: boolean | null
          service_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_zones: {
        Row: {
          client_id: string
          created_at: string
          id: string
          max_km: number | null
          min_km: number
          price: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          max_km?: number | null
          min_km?: number
          price: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          max_km?: number | null
          min_km?: number
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_zones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_zones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          created_at: string | null
          default_pickup_lat: number | null
          default_pickup_lng: number | null
          default_pickup_location: string | null
          default_service_type_id: string | null
          default_urgency_fee_id: string | null
          email_notifications_enabled: boolean | null
          id: string
          label_business_name: string | null
          label_tagline: string | null
          locale: string | null
          minimum_charge: number | null
          name: string
          notification_preferences: Json | null
          out_of_zone_base: number | null
          out_of_zone_per_km: number | null
          past_due_settings: Json | null
          phone: string | null
          prices_include_vat: boolean | null
          pricing_mode: string | null
          push_notifications_enabled: boolean | null
          role: string
          round_distance: boolean | null
          show_price_to_client: boolean | null
          show_price_to_courier: boolean | null
          time_slots: Json | null
          time_specific_price: number | null
          timezone: string | null
          vat_enabled: boolean | null
          vat_rate: number | null
          warehouse_lat: number | null
          warehouse_lng: number | null
          working_days: Json | null
          workload_settings: Json | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          default_pickup_lat?: number | null
          default_pickup_lng?: number | null
          default_pickup_location?: string | null
          default_service_type_id?: string | null
          default_urgency_fee_id?: string | null
          email_notifications_enabled?: boolean | null
          id: string
          label_business_name?: string | null
          label_tagline?: string | null
          locale?: string | null
          minimum_charge?: number | null
          name: string
          notification_preferences?: Json | null
          out_of_zone_base?: number | null
          out_of_zone_per_km?: number | null
          past_due_settings?: Json | null
          phone?: string | null
          prices_include_vat?: boolean | null
          pricing_mode?: string | null
          push_notifications_enabled?: boolean | null
          role: string
          round_distance?: boolean | null
          show_price_to_client?: boolean | null
          show_price_to_courier?: boolean | null
          time_slots?: Json | null
          time_specific_price?: number | null
          timezone?: string | null
          vat_enabled?: boolean | null
          vat_rate?: number | null
          warehouse_lat?: number | null
          warehouse_lng?: number | null
          working_days?: Json | null
          workload_settings?: Json | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          default_pickup_lat?: number | null
          default_pickup_lng?: number | null
          default_pickup_location?: string | null
          default_service_type_id?: string | null
          default_urgency_fee_id?: string | null
          email_notifications_enabled?: boolean | null
          id?: string
          label_business_name?: string | null
          label_tagline?: string | null
          locale?: string | null
          minimum_charge?: number | null
          name?: string
          notification_preferences?: Json | null
          out_of_zone_base?: number | null
          out_of_zone_per_km?: number | null
          past_due_settings?: Json | null
          phone?: string | null
          prices_include_vat?: boolean | null
          pricing_mode?: string | null
          push_notifications_enabled?: boolean | null
          role?: string
          round_distance?: boolean | null
          show_price_to_client?: boolean | null
          show_price_to_courier?: boolean | null
          time_slots?: Json | null
          time_specific_price?: number | null
          timezone?: string | null
          vat_enabled?: boolean | null
          vat_rate?: number | null
          warehouse_lat?: number | null
          warehouse_lng?: number | null
          working_days?: Json | null
          workload_settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_service_type_id_fkey"
            columns: ["default_service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_urgency_fee_id_fkey"
            columns: ["default_urgency_fee_id"]
            isOneToOne: false
            referencedRelation: "urgency_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_counters: {
        Row: {
          last_number: number
          updated_at: string
          year: number
        }
        Insert: {
          last_number?: number
          updated_at?: string
          year: number
        }
        Update: {
          last_number?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      service_reschedule_history: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          denial_reason: string | null
          id: string
          initiated_by: string
          initiated_by_role: string
          new_date: string
          new_time: string | null
          new_time_slot: string
          old_date: string | null
          old_time: string | null
          old_time_slot: string | null
          reason: string | null
          service_id: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          denial_reason?: string | null
          id?: string
          initiated_by: string
          initiated_by_role: string
          new_date: string
          new_time?: string | null
          new_time_slot: string
          old_date?: string | null
          old_time?: string | null
          old_time_slot?: string | null
          reason?: string | null
          service_id: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          denial_reason?: string | null
          id?: string
          initiated_by?: string
          initiated_by_role?: string
          new_date?: string
          new_time?: string | null
          new_time_slot?: string
          old_date?: string | null
          old_time?: string | null
          old_time_slot?: string | null
          reason?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_reschedule_history_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reschedule_history_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reschedule_history_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reschedule_history_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reschedule_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          service_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          service_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_status_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          calculated_price: number | null
          client_id: string
          created_at: string | null
          customer_reference: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_location: string
          detected_municipality: string | null
          display_id: string
          distance_km: number | null
          duration_minutes: number | null
          has_time_preference: boolean | null
          id: string
          is_out_of_zone: boolean | null
          last_past_due_notification_at: string | null
          last_rescheduled_at: string | null
          last_rescheduled_by: string | null
          notes: string | null
          pending_reschedule_date: string | null
          pending_reschedule_reason: string | null
          pending_reschedule_requested_at: string | null
          pending_reschedule_requested_by: string | null
          pending_reschedule_time: string | null
          pending_reschedule_time_slot: string | null
          pickup_detected_municipality: string | null
          pickup_is_out_of_zone: boolean | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_location: string
          price_breakdown: Json | null
          price_override_reason: string | null
          prices_include_vat_snapshot: boolean
          recipient_name: string | null
          recipient_phone: string | null
          rejection_reason: string | null
          request_status: string | null
          requested_date: string | null
          requested_time: string | null
          requested_time_slot: string | null
          reschedule_count: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          scheduled_time_slot: string | null
          service_type_id: string | null
          status: string
          suggested_date: string | null
          suggested_time: string | null
          suggested_time_slot: string | null
          tolls: number | null
          updated_at: string | null
          urgency_fee_id: string | null
          vat_rate_snapshot: number
        }
        Insert: {
          calculated_price?: number | null
          client_id: string
          created_at?: string | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_location: string
          detected_municipality?: string | null
          display_id: string
          distance_km?: number | null
          duration_minutes?: number | null
          has_time_preference?: boolean | null
          id?: string
          is_out_of_zone?: boolean | null
          last_past_due_notification_at?: string | null
          last_rescheduled_at?: string | null
          last_rescheduled_by?: string | null
          notes?: string | null
          pending_reschedule_date?: string | null
          pending_reschedule_reason?: string | null
          pending_reschedule_requested_at?: string | null
          pending_reschedule_requested_by?: string | null
          pending_reschedule_time?: string | null
          pending_reschedule_time_slot?: string | null
          pickup_detected_municipality?: string | null
          pickup_is_out_of_zone?: boolean | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location: string
          price_breakdown?: Json | null
          price_override_reason?: string | null
          prices_include_vat_snapshot?: boolean
          recipient_name?: string | null
          recipient_phone?: string | null
          rejection_reason?: string | null
          request_status?: string | null
          requested_date?: string | null
          requested_time?: string | null
          requested_time_slot?: string | null
          reschedule_count?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          scheduled_time_slot?: string | null
          service_type_id?: string | null
          status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          suggested_time_slot?: string | null
          tolls?: number | null
          updated_at?: string | null
          urgency_fee_id?: string | null
          vat_rate_snapshot?: number
        }
        Update: {
          calculated_price?: number | null
          client_id?: string
          created_at?: string | null
          customer_reference?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_location?: string
          detected_municipality?: string | null
          display_id?: string
          distance_km?: number | null
          duration_minutes?: number | null
          has_time_preference?: boolean | null
          id?: string
          is_out_of_zone?: boolean | null
          last_past_due_notification_at?: string | null
          last_rescheduled_at?: string | null
          last_rescheduled_by?: string | null
          notes?: string | null
          pending_reschedule_date?: string | null
          pending_reschedule_reason?: string | null
          pending_reschedule_requested_at?: string | null
          pending_reschedule_requested_by?: string | null
          pending_reschedule_time?: string | null
          pending_reschedule_time_slot?: string | null
          pickup_detected_municipality?: string | null
          pickup_is_out_of_zone?: boolean | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_location?: string
          price_breakdown?: Json | null
          price_override_reason?: string | null
          prices_include_vat_snapshot?: boolean
          recipient_name?: string | null
          recipient_phone?: string | null
          rejection_reason?: string | null
          request_status?: string | null
          requested_date?: string | null
          requested_time?: string | null
          requested_time_slot?: string | null
          reschedule_count?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          scheduled_time_slot?: string | null
          service_type_id?: string | null
          status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          suggested_time_slot?: string | null
          tolls?: number | null
          updated_at?: string | null
          urgency_fee_id?: string | null
          vat_rate_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_last_rescheduled_by_fkey"
            columns: ["last_rescheduled_by"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_last_rescheduled_by_fkey"
            columns: ["last_rescheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_pending_reschedule_requested_by_fkey"
            columns: ["pending_reschedule_requested_by"]
            isOneToOne: false
            referencedRelation: "courier_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_pending_reschedule_requested_by_fkey"
            columns: ["pending_reschedule_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_urgency_fee_id_fkey"
            columns: ["urgency_fee_id"]
            isOneToOne: false
            referencedRelation: "urgency_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      urgency_fees: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          flat_fee: number
          id: string
          multiplier: number
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          flat_fee?: number
          id?: string
          multiplier?: number
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          flat_fee?: number
          id?: string
          multiplier?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      courier_public_profile: {
        Row: {
          default_service_type_id: string | null
          default_urgency_fee_id: string | null
          id: string | null
          label_business_name: string | null
          label_tagline: string | null
          locale: string | null
          minimum_charge: number | null
          name: string | null
          out_of_zone_base: number | null
          out_of_zone_per_km: number | null
          past_due_settings: Json | null
          phone: string | null
          prices_include_vat: boolean | null
          pricing_mode: string | null
          round_distance: boolean | null
          show_price_to_client: boolean | null
          show_price_to_courier: boolean | null
          time_slots: Json | null
          time_specific_price: number | null
          timezone: string | null
          vat_enabled: boolean | null
          vat_rate: number | null
          working_days: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_service_type_id_fkey"
            columns: ["default_service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_urgency_fee_id_fkey"
            columns: ["default_urgency_fee_id"]
            isOneToOne: false
            referencedRelation: "urgency_fees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_reschedule: { Args: { p_service_id: string }; Returns: Json }
      bulk_recalculate_service_prices: {
        Args: {
          p_client_id: string
          p_minimum_charge?: number
          p_service_ids: string[]
        }
        Returns: Json
      }
      bulk_recalculate_type_based_prices: {
        Args: { p_client_id: string; p_service_ids: string[] }
        Returns: Json
      }
      bulk_reschedule_services: {
        Args: {
          p_new_date: string
          p_new_time?: string
          p_new_time_slot: string
          p_reason?: string
          p_service_ids: string[]
          p_user_id?: string
        }
        Returns: Json
      }
      calculate_service_price: {
        Args: {
          p_client_id: string
          p_distance_km: number
          p_urgency_fee_id?: string
        }
        Returns: {
          price_breakdown: Json
          total_price: number
        }[]
      }
      client_approve_reschedule: {
        Args: { p_service_id: string }
        Returns: Json
      }
      client_deny_reschedule: {
        Args: { p_denial_reason?: string; p_service_id: string }
        Returns: Json
      }
      deny_reschedule: {
        Args: { p_denial_reason?: string; p_service_id: string }
        Returns: Json
      }
      get_courier_warehouse_coords: {
        Args: never
        Returns: {
          warehouse_lat: number
          warehouse_lng: number
        }[]
      }
      get_notification_text: {
        Args: { key: string; locale: string; params?: Json }
        Returns: string
      }
      is_courier: { Args: never; Returns: boolean }
      replace_distribution_zones: {
        Args: { new_zones: Json }
        Returns: undefined
      }
      replace_pricing_zones: {
        Args: { p_client_id: string; p_zones: Json }
        Returns: Json
      }
      reschedule_service:
        | {
            Args: {
              p_new_date: string
              p_new_time?: string
              p_new_time_slot: string
              p_notification_message?: string
              p_notification_title?: string
              p_reason?: string
              p_service_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_new_date: string
              p_new_time?: string
              p_new_time_slot: string
              p_notification_message?: string
              p_notification_title?: string
              p_reason?: string
              p_service_id: string
            }
            Returns: Json
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
