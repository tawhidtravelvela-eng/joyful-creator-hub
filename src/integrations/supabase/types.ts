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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_price_cache: {
        Row: {
          activity_name: string
          city: string
          confidence: string | null
          country: string | null
          created_at: string
          currency: string
          expires_at: string
          id: string
          includes_notes: string | null
          local_currency: string | null
          price_local: number | null
          price_usd: number
          source: string | null
          updated_at: string | null
        }
        Insert: {
          activity_name: string
          city: string
          confidence?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          includes_notes?: string | null
          local_currency?: string | null
          price_local?: number | null
          price_usd?: number
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_name?: string
          city?: string
          confidence?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          includes_notes?: string | null
          local_currency?: string | null
          price_local?: number | null
          price_usd?: number
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      affiliate_api_keys: {
        Row: {
          affiliate_id: string
          allowed_domains: string[] | null
          api_key: string
          created_at: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string | null
          rate_limit_per_minute: number | null
        }
        Insert: {
          affiliate_id: string
          allowed_domains?: string[] | null
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          rate_limit_per_minute?: number | null
        }
        Update: {
          affiliate_id?: string
          allowed_domains?: string[] | null
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          rate_limit_per_minute?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_api_keys_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_campaigns: {
        Row: {
          affiliate_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          starts_at: string | null
          target_product_type: string | null
          target_url: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          starts_at?: string | null
          target_product_type?: string | null
          target_url?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          starts_at?: string | null
          target_product_type?: string | null
          target_url?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_campaigns_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          country: string | null
          created_at: string
          id: string
          ip_hash: string | null
          page_url: string | null
          referrer_url: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          country?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          page_url?: string | null
          referrer_url?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          country?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          page_url?: string | null
          referrer_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          affiliate_id: string
          booking_amount: number
          booking_id: string | null
          click_id: string | null
          commission_amount: number
          commission_rate: number
          created_at: string
          currency: string
          id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          affiliate_id: string
          booking_amount?: number
          booking_id?: string | null
          click_id?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          affiliate_id?: string
          booking_amount?: number
          booking_id?: string | null
          click_id?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          admin_notes: string | null
          affiliate_id: string
          amount: number
          created_at: string
          currency: string
          id: string
          payment_method: string | null
          payment_reference: string | null
          processed_at: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          affiliate_id: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          affiliate_id?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          base_currency: string
          commission_rate: number
          company_name: string | null
          created_at: string
          id: string
          min_payout: number
          notes: string | null
          payment_method: string | null
          status: string
          total_earnings: number
          total_paid: number
          updated_at: string | null
          user_id: string
          wallet_balance: number
          website_url: string | null
        }
        Insert: {
          affiliate_code: string
          base_currency?: string
          commission_rate?: number
          company_name?: string | null
          created_at?: string
          id?: string
          min_payout?: number
          notes?: string | null
          payment_method?: string | null
          status?: string
          total_earnings?: number
          total_paid?: number
          updated_at?: string | null
          user_id: string
          wallet_balance?: number
          website_url?: string | null
        }
        Update: {
          affiliate_code?: string
          base_currency?: string
          commission_rate?: number
          company_name?: string | null
          created_at?: string
          id?: string
          min_payout?: number
          notes?: string | null
          payment_method?: string | null
          status?: string
          total_earnings?: number
          total_paid?: number
          updated_at?: string | null
          user_id?: string
          wallet_balance?: number
          website_url?: string | null
        }
        Relationships: []
      }
      agent_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          branch: string | null
          country: string | null
          created_at: string
          currency: string
          id: string
          instructions: string | null
          is_active: boolean | null
          logo_url: string | null
          routing_number: string | null
          sort_order: number | null
          swift_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string
          account_number?: string
          bank_name: string
          branch?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          routing_number?: string | null
          sort_order?: number | null
          swift_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          branch?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          routing_number?: string | null
          sort_order?: number | null
          swift_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_markup_settings: {
        Row: {
          applies_to: string
          created_at: string
          id: string
          markup_type: string
          markup_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          applies_to?: string
          created_at?: string
          id?: string
          markup_type?: string
          markup_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          id?: string
          markup_type?: string
          markup_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_payment_gateways: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          provider: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          base_url: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          is_configured: boolean
          notes: string | null
          provider: string
          secret_name: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          is_configured?: boolean
          notes?: string | null
          provider: string
          secret_name: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_configured?: boolean
          notes?: string | null
          provider?: string
          secret_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_task_configs: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          fallback_chain: Json
          id: string
          is_locked: boolean
          max_tokens: number | null
          model: string
          notes: string | null
          provider: string
          task_category: string
          task_key: string
          task_label: string
          temperature: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          fallback_chain?: Json
          id?: string
          is_locked?: boolean
          max_tokens?: number | null
          model?: string
          notes?: string | null
          provider?: string
          task_category?: string
          task_key: string
          task_label: string
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          fallback_chain?: Json
          id?: string
          is_locked?: boolean
          max_tokens?: number | null
          model?: string
          notes?: string | null
          provider?: string
          task_category?: string
          task_key?: string
          task_label?: string
          temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          estimated_cost: number | null
          function_name: string | null
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          provider: string
          route_reason: string | null
          success: boolean | null
          total_tokens: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          estimated_cost?: number | null
          function_name?: string | null
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          provider?: string
          route_reason?: string | null
          success?: boolean | null
          total_tokens?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          estimated_cost?: number | null
          function_name?: string | null
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          provider?: string
          route_reason?: string | null
          success?: boolean | null
          total_tokens?: number | null
        }
        Relationships: []
      }
      airline_settings: {
        Row: {
          airline_code: string
          airline_name: string | null
          cabin_baggage: string | null
          cancellation_policy: string | null
          checkin_baggage: string | null
          created_at: string
          date_change_policy: string | null
          from_code: string | null
          id: string
          name_change_policy: string | null
          no_show_policy: string | null
          scope_type: string
          to_code: string | null
          updated_at: string | null
        }
        Insert: {
          airline_code: string
          airline_name?: string | null
          cabin_baggage?: string | null
          cancellation_policy?: string | null
          checkin_baggage?: string | null
          created_at?: string
          date_change_policy?: string | null
          from_code?: string | null
          id?: string
          name_change_policy?: string | null
          no_show_policy?: string | null
          scope_type?: string
          to_code?: string | null
          updated_at?: string | null
        }
        Update: {
          airline_code?: string
          airline_name?: string | null
          cabin_baggage?: string | null
          cancellation_policy?: string | null
          checkin_baggage?: string | null
          created_at?: string
          date_change_policy?: string | null
          from_code?: string | null
          id?: string
          name_change_policy?: string | null
          no_show_policy?: string | null
          scope_type?: string
          to_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      airports: {
        Row: {
          city: string
          country: string | null
          created_at: string
          iata_code: string
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
        }
        Insert: {
          city: string
          country?: string | null
          created_at?: string
          iata_code: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
        }
        Update: {
          city?: string
          country?: string | null
          created_at?: string
          iata_code?: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
        }
        Relationships: []
      }
      api_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          provider: string
          settings: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider: string
          settings?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          settings?: Json | null
        }
        Relationships: []
      }
      attraction_sync_state: {
        Row: {
          ai_enriched_at: string | null
          attraction_count: number | null
          city: string
          country: string
          created_at: string
          error_message: string | null
          id: string
          last_synced_at: string | null
          priority: number | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_enriched_at?: string | null
          attraction_count?: number | null
          city: string
          country?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          priority?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_enriched_at?: string | null
          attraction_count?: number | null
          city?: string
          country?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          priority?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      attractions: {
        Row: {
          ai_enriched: boolean | null
          ai_rank: number | null
          best_time_to_visit: string | null
          category: string
          city: string
          country: string
          created_at: string
          description: string | null
          description_source: string | null
          enriched_at: string | null
          id: string
          image_url: string | null
          itinerary_tags: string[] | null
          latitude: number | null
          longitude: number | null
          name: string
          name_en: string | null
          osm_id: number | null
          osm_type: string | null
          popularity_score: number | null
          subcategory: string | null
          suggested_duration: string | null
          sync_source: string | null
          tags: string[] | null
          updated_at: string
          wikidata_id: string | null
          wikipedia_url: string | null
        }
        Insert: {
          ai_enriched?: boolean | null
          ai_rank?: number | null
          best_time_to_visit?: string | null
          category?: string
          city?: string
          country?: string
          created_at?: string
          description?: string | null
          description_source?: string | null
          enriched_at?: string | null
          id?: string
          image_url?: string | null
          itinerary_tags?: string[] | null
          latitude?: number | null
          longitude?: number | null
          name: string
          name_en?: string | null
          osm_id?: number | null
          osm_type?: string | null
          popularity_score?: number | null
          subcategory?: string | null
          suggested_duration?: string | null
          sync_source?: string | null
          tags?: string[] | null
          updated_at?: string
          wikidata_id?: string | null
          wikipedia_url?: string | null
        }
        Update: {
          ai_enriched?: boolean | null
          ai_rank?: number | null
          best_time_to_visit?: string | null
          category?: string
          city?: string
          country?: string
          created_at?: string
          description?: string | null
          description_source?: string | null
          enriched_at?: string | null
          id?: string
          image_url?: string | null
          itinerary_tags?: string[] | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          name_en?: string | null
          osm_id?: number | null
          osm_type?: string | null
          popularity_score?: number | null
          subcategory?: string | null
          suggested_duration?: string | null
          sync_source?: string | null
          tags?: string[] | null
          updated_at?: string
          wikidata_id?: string | null
          wikipedia_url?: string | null
        }
        Relationships: []
      }
      b2b_access_requests: {
        Row: {
          admin_notes: string | null
          assigned_tenant_name: string | null
          business_justification: string | null
          company_name: string | null
          created_at: string
          domain_requested: string | null
          id: string
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_tenant_name?: string | null
          business_justification?: string | null
          company_name?: string | null
          created_at?: string
          domain_requested?: string | null
          id?: string
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          assigned_tenant_name?: string | null
          business_justification?: string | null
          company_name?: string | null
          created_at?: string
          domain_requested?: string | null
          id?: string
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_access_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_plan_prices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          plan_key: string
          price_kind: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          notes?: string | null
          plan_key: string
          price_kind: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          plan_key?: string
          price_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "b2b_plan_prices_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "b2b_plans"
            referencedColumns: ["plan_key"]
          },
        ]
      }
      b2b_plans: {
        Row: {
          allow_ai_copy: boolean
          allow_auto_blog: boolean
          allow_blog: boolean
          allow_custom_domain: boolean
          allow_flights: boolean
          allow_full_rebuild: boolean
          allow_hotels: boolean
          allow_remove_branding: boolean
          allow_tours: boolean
          allow_transfers: boolean
          badge_label: string | null
          created_at: string
          description: string | null
          display_name: string
          features: Json
          first_year_price_usd: number
          is_active: boolean
          is_featured: boolean
          max_pages: number
          max_section_variants: number
          monthly_ai_credit_usd: number
          monthly_price_usd: number
          plan_key: string
          renewal_price_usd: number
          sort_order: number
          trial_days: number
          updated_at: string
          yearly_price_usd: number
        }
        Insert: {
          allow_ai_copy?: boolean
          allow_auto_blog?: boolean
          allow_blog?: boolean
          allow_custom_domain?: boolean
          allow_flights?: boolean
          allow_full_rebuild?: boolean
          allow_hotels?: boolean
          allow_remove_branding?: boolean
          allow_tours?: boolean
          allow_transfers?: boolean
          badge_label?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          features?: Json
          first_year_price_usd?: number
          is_active?: boolean
          is_featured?: boolean
          max_pages?: number
          max_section_variants?: number
          monthly_ai_credit_usd?: number
          monthly_price_usd?: number
          plan_key: string
          renewal_price_usd?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
          yearly_price_usd?: number
        }
        Update: {
          allow_ai_copy?: boolean
          allow_auto_blog?: boolean
          allow_blog?: boolean
          allow_custom_domain?: boolean
          allow_flights?: boolean
          allow_full_rebuild?: boolean
          allow_hotels?: boolean
          allow_remove_branding?: boolean
          allow_tours?: boolean
          allow_transfers?: boolean
          badge_label?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          features?: Json
          first_year_price_usd?: number
          is_active?: boolean
          is_featured?: boolean
          max_pages?: number
          max_section_variants?: number
          monthly_ai_credit_usd?: number
          monthly_price_usd?: number
          plan_key?: string
          renewal_price_usd?: number
          sort_order?: number
          trial_days?: number
          updated_at?: string
          yearly_price_usd?: number
        }
        Relationships: []
      }
      baggage_cache: {
        Row: {
          airline_code: string
          cabin_baggage: string | null
          cached_at: string
          checkin_baggage: string | null
          created_at: string
          expires_at: string
          fare_class: string
          from_code: string
          id: string
          source: string | null
          to_code: string
          updated_at: string | null
        }
        Insert: {
          airline_code: string
          cabin_baggage?: string | null
          cached_at?: string
          checkin_baggage?: string | null
          created_at?: string
          expires_at?: string
          fare_class?: string
          from_code: string
          id?: string
          source?: string | null
          to_code: string
          updated_at?: string | null
        }
        Update: {
          airline_code?: string
          cabin_baggage?: string | null
          cached_at?: string
          checkin_baggage?: string | null
          created_at?: string
          expires_at?: string
          fare_class?: string
          from_code?: string
          id?: string
          source?: string | null
          to_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          branch: string | null
          country: string | null
          created_at: string
          currency: string
          id: string
          instructions: string | null
          is_active: boolean | null
          logo_url: string | null
          routing_number: string | null
          sort_order: number | null
          swift_code: string | null
          updated_at: string | null
        }
        Insert: {
          account_name?: string
          account_number?: string
          bank_name: string
          branch?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          routing_number?: string | null
          sort_order?: number | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          branch?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          routing_number?: string | null
          sort_order?: number | null
          swift_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          sort_order: number | null
          subtitle: string | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          subtitle?: string | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          subtitle?: string | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: []
      }
      block_library: {
        Row: {
          ai_compose_weight: number
          audience_tags: string[]
          block_key: string
          category: string
          component_path: string | null
          created_at: string
          default_content_schema: Json | null
          density: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          mood_tags: string[]
          preview_image_url: string | null
          required_plan_key: string | null
          source_skin: string | null
          updated_at: string
          vertical_tags: string[]
        }
        Insert: {
          ai_compose_weight?: number
          audience_tags?: string[]
          block_key: string
          category: string
          component_path?: string | null
          created_at?: string
          default_content_schema?: Json | null
          density?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          mood_tags?: string[]
          preview_image_url?: string | null
          required_plan_key?: string | null
          source_skin?: string | null
          updated_at?: string
          vertical_tags?: string[]
        }
        Update: {
          ai_compose_weight?: number
          audience_tags?: string[]
          block_key?: string
          category?: string
          component_path?: string | null
          created_at?: string
          default_content_schema?: Json | null
          density?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          mood_tags?: string[]
          preview_image_url?: string | null
          required_plan_key?: string | null
          source_skin?: string | null
          updated_at?: string
          vertical_tags?: string[]
        }
        Relationships: []
      }
      blog_author_profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          country: string | null
          created_at: string | null
          expertise: string[] | null
          id: string
          is_active: boolean | null
          name: string
          region: string
          slug: string
          social_links: Json | null
          tenant_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio: string
          country?: string | null
          created_at?: string | null
          expertise?: string[] | null
          id?: string
          is_active?: boolean | null
          name: string
          region?: string
          slug: string
          social_links?: Json | null
          tenant_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          country?: string | null
          created_at?: string | null
          expertise?: string[] | null
          id?: string
          is_active?: boolean | null
          name?: string
          region?: string
          slug?: string
          social_links?: Json | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_author_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          author_profile_id: string | null
          category_id: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          language: string | null
          published_at: string | null
          slug: string
          status: string | null
          tags: Json | null
          tenant_id: string | null
          title: string
          word_count: number | null
        }
        Insert: {
          author_name?: string | null
          author_profile_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          language?: string | null
          published_at?: string | null
          slug: string
          status?: string | null
          tags?: Json | null
          tenant_id?: string | null
          title: string
          word_count?: number | null
        }
        Update: {
          author_name?: string | null
          author_profile_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          language?: string | null
          published_at?: string | null
          slug?: string
          status?: string | null
          tags?: Json | null
          tenant_id?: string | null
          title?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "blog_author_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_currency: string
          booking_id: string
          confirmation_data: Json | null
          confirmation_number: string | null
          created_at: string
          details: Json | null
          fx_markup_used: number | null
          fx_rate_used: number | null
          id: string
          source_amount: number | null
          source_currency: string | null
          status: string
          subtitle: string | null
          tenant_id: string | null
          title: string
          total: number
          type: string
          user_id: string
        }
        Insert: {
          booked_currency?: string
          booking_id: string
          confirmation_data?: Json | null
          confirmation_number?: string | null
          created_at?: string
          details?: Json | null
          fx_markup_used?: number | null
          fx_rate_used?: number | null
          id?: string
          source_amount?: number | null
          source_currency?: string | null
          status?: string
          subtitle?: string | null
          tenant_id?: string | null
          title: string
          total?: number
          type?: string
          user_id: string
        }
        Update: {
          booked_currency?: string
          booking_id?: string
          confirmation_data?: Json | null
          confirmation_number?: string | null
          created_at?: string
          details?: Json | null
          fx_markup_used?: number | null
          fx_rate_used?: number | null
          id?: string
          source_amount?: number | null
          source_currency?: string | null
          status?: string
          subtitle?: string | null
          tenant_id?: string | null
          title?: string
          total?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      city_intros: {
        Row: {
          best_time_to_visit: string | null
          budget_ranges: Json | null
          city_name: string
          country: string | null
          created_at: string | null
          hero_image_url: string | null
          id: string
          intro_text: string
          language: string | null
          popular_areas: Json | null
          updated_at: string | null
        }
        Insert: {
          best_time_to_visit?: string | null
          budget_ranges?: Json | null
          city_name: string
          country?: string | null
          created_at?: string | null
          hero_image_url?: string | null
          id?: string
          intro_text: string
          language?: string | null
          popular_areas?: Json | null
          updated_at?: string | null
        }
        Update: {
          best_time_to_visit?: string | null
          budget_ranges?: Json | null
          city_name?: string
          country?: string | null
          created_at?: string | null
          hero_image_url?: string | null
          id?: string
          intro_text?: string
          language?: string | null
          popular_areas?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      city_landmarks_cache: {
        Row: {
          city_name: string
          created_at: string
          id: string
          landmarks: Json
          source: string
          updated_at: string
        }
        Insert: {
          city_name: string
          created_at?: string
          id?: string
          landmarks?: Json
          source?: string
          updated_at?: string
        }
        Update: {
          city_name?: string
          created_at?: string
          id?: string
          landmarks?: Json
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          amount: number
          api_provider: string
          carrier_code: string
          commission_type: string
          created_at: string
          id: string
          is_active: boolean
          module: string
          origin: string | null
          profit_type: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          api_provider?: string
          carrier_code?: string
          commission_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          module?: string
          origin?: string | null
          profit_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          api_provider?: string
          carrier_code?: string
          commission_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          module?: string
          origin?: string | null
          profit_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_classification_cache: {
        Row: {
          classification: string
          country: string | null
          created_at: string | null
          dest_id: string | null
          hit_count: number | null
          resolved_cities: string[] | null
          term: string
          updated_at: string | null
        }
        Insert: {
          classification: string
          country?: string | null
          created_at?: string | null
          dest_id?: string | null
          hit_count?: number | null
          resolved_cities?: string[] | null
          term: string
          updated_at?: string | null
        }
        Update: {
          classification?: string
          country?: string | null
          created_at?: string | null
          dest_id?: string | null
          hit_count?: number | null
          resolved_cities?: string[] | null
          term?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      destinations: {
        Row: {
          country: string | null
          created_at: string
          flights: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number | null
          rating: number | null
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          flights?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price?: number | null
          rating?: number | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          flights?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number | null
          rating?: number | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      featured_travel_items: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          item_type: string
          match_field: string
          match_value: string
          priority_boost: number
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          item_type: string
          match_field?: string
          match_value: string
          priority_boost?: number
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          item_type?: string
          match_field?: string
          match_value?: string
          priority_boost?: number
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      flight_insights_cache: {
        Row: {
          cache_key: string
          created_at: string
          depart_date: string | null
          expires_at: string
          from_code: string
          id: string
          insights: Json
          return_date: string | null
          source: string | null
          to_code: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          depart_date?: string | null
          expires_at?: string
          from_code: string
          id?: string
          insights: Json
          return_date?: string | null
          source?: string | null
          to_code: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          depart_date?: string | null
          expires_at?: string
          from_code?: string
          id?: string
          insights?: Json
          return_date?: string | null
          source?: string | null
          to_code?: string
        }
        Relationships: []
      }
      flight_price_cache: {
        Row: {
          adults: number | null
          cabin_class: string | null
          cached_at: string | null
          children: number | null
          created_at: string
          currency: string | null
          expires_at: string | null
          from_code: string
          id: string
          infants: number | null
          lowest_price: number | null
          source: string | null
          to_code: string
          travel_date: string
        }
        Insert: {
          adults?: number | null
          cabin_class?: string | null
          cached_at?: string | null
          children?: number | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          from_code: string
          id?: string
          infants?: number | null
          lowest_price?: number | null
          source?: string | null
          to_code: string
          travel_date: string
        }
        Update: {
          adults?: number | null
          cabin_class?: string | null
          cached_at?: string | null
          children?: number | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          from_code?: string
          id?: string
          infants?: number | null
          lowest_price?: number | null
          source?: string | null
          to_code?: string
          travel_date?: string
        }
        Relationships: []
      }
      flight_price_trends: {
        Row: {
          avg_price: number
          created_at: string
          currency: string | null
          depart_date: string
          from_code: string
          id: string
          max_price: number | null
          min_price: number
          sample_count: number | null
          sample_date: string
          to_code: string
        }
        Insert: {
          avg_price: number
          created_at?: string
          currency?: string | null
          depart_date: string
          from_code: string
          id?: string
          max_price?: number | null
          min_price: number
          sample_count?: number | null
          sample_date?: string
          to_code: string
        }
        Update: {
          avg_price?: number
          created_at?: string
          currency?: string | null
          depart_date?: string
          from_code?: string
          id?: string
          max_price?: number | null
          min_price?: number
          sample_count?: number | null
          sample_date?: string
          to_code?: string
        }
        Relationships: []
      }
      flight_search_cache: {
        Row: {
          cache_key: string
          created_at: string
          depart_date: string | null
          expires_at: string
          from_code: string
          id: string
          payload: Json
          result_count: number
          return_date: string | null
          tenant_id: string | null
          to_code: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          depart_date?: string | null
          expires_at: string
          from_code: string
          id?: string
          payload: Json
          result_count?: number
          return_date?: string | null
          tenant_id?: string | null
          to_code: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          depart_date?: string | null
          expires_at?: string
          from_code?: string
          id?: string
          payload?: Json
          result_count?: number
          return_date?: string | null
          tenant_id?: string | null
          to_code?: string
        }
        Relationships: []
      }
      flight_search_signals: {
        Row: {
          adults: number | null
          cabin_class: string | null
          children: number | null
          created_at: string
          currency: string | null
          depart_date: string | null
          from_code: string
          id: string
          infants: number | null
          lowest_price: number | null
          results_count: number | null
          return_date: string | null
          search_country: string | null
          selected_flight_id: string | null
          selected_price: number | null
          to_code: string
          trip_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          adults?: number | null
          cabin_class?: string | null
          children?: number | null
          created_at?: string
          currency?: string | null
          depart_date?: string | null
          from_code: string
          id?: string
          infants?: number | null
          lowest_price?: number | null
          results_count?: number | null
          return_date?: string | null
          search_country?: string | null
          selected_flight_id?: string | null
          selected_price?: number | null
          to_code: string
          trip_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          adults?: number | null
          cabin_class?: string | null
          children?: number | null
          created_at?: string
          currency?: string | null
          depart_date?: string | null
          from_code?: string
          id?: string
          infants?: number | null
          lowest_price?: number | null
          results_count?: number | null
          return_date?: string | null
          search_country?: string | null
          selected_flight_id?: string | null
          selected_price?: number | null
          to_code?: string
          trip_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      flights: {
        Row: {
          airline: string
          arrival: string | null
          class: string | null
          created_at: string
          departure: string | null
          duration: string | null
          from_city: string
          id: string
          is_active: boolean | null
          markup_percentage: number | null
          price: number | null
          seats: number | null
          stops: number | null
          to_city: string
        }
        Insert: {
          airline: string
          arrival?: string | null
          class?: string | null
          created_at?: string
          departure?: string | null
          duration?: string | null
          from_city: string
          id?: string
          is_active?: boolean | null
          markup_percentage?: number | null
          price?: number | null
          seats?: number | null
          stops?: number | null
          to_city: string
        }
        Update: {
          airline?: string
          arrival?: string | null
          class?: string | null
          created_at?: string
          departure?: string | null
          duration?: string | null
          from_city?: string
          id?: string
          is_active?: boolean | null
          markup_percentage?: number | null
          price?: number | null
          seats?: number | null
          stops?: number | null
          to_city?: string
        }
        Relationships: []
      }
      google_place_id_cache: {
        Row: {
          created_at: string
          fail_count: number
          id: string
          last_used_at: string
          lat: number | null
          lng: number | null
          name: string | null
          place_id: string
          query: string
        }
        Insert: {
          created_at?: string
          fail_count?: number
          id?: string
          last_used_at?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          place_id: string
          query: string
        }
        Update: {
          created_at?: string
          fail_count?: number
          id?: string
          last_used_at?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          place_id?: string
          query?: string
        }
        Relationships: []
      }
      high_demand_dates: {
        Row: {
          country: string | null
          created_at: string
          date: string
          fetched_year: number | null
          id: string
          label: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          date: string
          fetched_year?: number | null
          id?: string
          label?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          date?: string
          fetched_year?: number | null
          id?: string
          label?: string | null
        }
        Relationships: []
      }
      hotel_city_estimates: {
        Row: {
          avg_per_night_usd: number
          city: string
          country: string | null
          min_per_night_usd: number
          sample_count: number
          source: string
          updated_at: string
        }
        Insert: {
          avg_per_night_usd?: number
          city: string
          country?: string | null
          min_per_night_usd?: number
          sample_count?: number
          source?: string
          updated_at?: string
        }
        Update: {
          avg_per_night_usd?: number
          city?: string
          country?: string | null
          min_per_night_usd?: number
          sample_count?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotel_detail_snapshot: {
        Row: {
          checkin: string
          checkout: string
          created_at: string
          hotel_uid: string
          id: string
          last_checked_at: string
          occupancy_key: string
          options_count: number | null
          raw_detail_json: Json | null
          search_hotel_id: string | null
          updated_at: string
        }
        Insert: {
          checkin: string
          checkout: string
          created_at?: string
          hotel_uid: string
          id?: string
          last_checked_at?: string
          occupancy_key?: string
          options_count?: number | null
          raw_detail_json?: Json | null
          search_hotel_id?: string | null
          updated_at?: string
        }
        Update: {
          checkin?: string
          checkout?: string
          created_at?: string
          hotel_uid?: string
          id?: string
          last_checked_at?: string
          occupancy_key?: string
          options_count?: number | null
          raw_detail_json?: Json | null
          search_hotel_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hotel_interactions: {
        Row: {
          action: string
          city: string
          created_at: string
          hotel_id: string
          hotel_name: string
          id: string
          session_id: string | null
          stars: number | null
          user_id: string | null
        }
        Insert: {
          action?: string
          city?: string
          created_at?: string
          hotel_id: string
          hotel_name?: string
          id?: string
          session_id?: string | null
          stars?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          city?: string
          created_at?: string
          hotel_id?: string
          hotel_name?: string
          id?: string
          session_id?: string | null
          stars?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      hotel_option_snapshot: {
        Row: {
          availability_status: string | null
          cancellation_deadline_at: string | null
          cancellation_is_free: boolean | null
          cancellation_policy_raw_json: Json | null
          cancellation_text: string | null
          cancellation_type: string | null
          checkin: string
          checkout: string
          created_at: string
          currency: string | null
          hotel_uid: string
          id: string
          is_package_rate: boolean | null
          last_checked_at: string
          meal_basis: string | null
          occupancy_key: string
          option_id: string
          pan_required: boolean | null
          passport_required: boolean | null
          total_price: number | null
          updated_at: string
        }
        Insert: {
          availability_status?: string | null
          cancellation_deadline_at?: string | null
          cancellation_is_free?: boolean | null
          cancellation_policy_raw_json?: Json | null
          cancellation_text?: string | null
          cancellation_type?: string | null
          checkin: string
          checkout: string
          created_at?: string
          currency?: string | null
          hotel_uid: string
          id?: string
          is_package_rate?: boolean | null
          last_checked_at?: string
          meal_basis?: string | null
          occupancy_key?: string
          option_id: string
          pan_required?: boolean | null
          passport_required?: boolean | null
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          availability_status?: string | null
          cancellation_deadline_at?: string | null
          cancellation_is_free?: boolean | null
          cancellation_policy_raw_json?: Json | null
          cancellation_text?: string | null
          cancellation_type?: string | null
          checkin?: string
          checkout?: string
          created_at?: string
          currency?: string | null
          hotel_uid?: string
          id?: string
          is_package_rate?: boolean | null
          last_checked_at?: string
          meal_basis?: string | null
          occupancy_key?: string
          option_id?: string
          pan_required?: boolean | null
          passport_required?: boolean | null
          total_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      hotel_popularity_scores: {
        Row: {
          booking_count: number
          city: string
          click_count: number
          hotel_name: string
          hotel_uid: string
          last_booked_at: string | null
          last_clicked_at: string | null
          popularity_rank: number
          updated_at: string
          view_count: number
        }
        Insert: {
          booking_count?: number
          city?: string
          click_count?: number
          hotel_name?: string
          hotel_uid: string
          last_booked_at?: string | null
          last_clicked_at?: string | null
          popularity_rank?: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          booking_count?: number
          city?: string
          click_count?: number
          hotel_name?: string
          hotel_uid?: string
          last_booked_at?: string | null
          last_clicked_at?: string | null
          popularity_rank?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      hotel_price_history: {
        Row: {
          change_type: string | null
          changed_at: string
          checkin: string | null
          checkout: string | null
          currency: string | null
          hotel_uid: string
          id: string
          new_price: number
          old_price: number
          option_id: string | null
          room_id: string | null
        }
        Insert: {
          change_type?: string | null
          changed_at?: string
          checkin?: string | null
          checkout?: string | null
          currency?: string | null
          hotel_uid: string
          id?: string
          new_price?: number
          old_price?: number
          option_id?: string | null
          room_id?: string | null
        }
        Update: {
          change_type?: string | null
          changed_at?: string
          checkin?: string | null
          checkout?: string | null
          currency?: string | null
          hotel_uid?: string
          id?: string
          new_price?: number
          old_price?: number
          option_id?: string | null
          room_id?: string | null
        }
        Relationships: []
      }
      hotel_room_snapshot: {
        Row: {
          created_at: string
          description: string | null
          facilities_json: Json | null
          hotel_uid: string
          id: string
          images_json: Json | null
          meal_basis: string | null
          occupancy_json: Json | null
          option_id: string
          room_details_json: Json | null
          room_id: string
          room_name: string | null
          standard_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          facilities_json?: Json | null
          hotel_uid: string
          id?: string
          images_json?: Json | null
          meal_basis?: string | null
          occupancy_json?: Json | null
          option_id: string
          room_details_json?: Json | null
          room_id: string
          room_name?: string | null
          standard_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          facilities_json?: Json | null
          hotel_uid?: string
          id?: string
          images_json?: Json | null
          meal_basis?: string | null
          occupancy_json?: Json | null
          option_id?: string
          room_details_json?: Json | null
          room_id?: string
          room_name?: string | null
          standard_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hotel_search_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          result_count: number
          results: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          result_count?: number
          results?: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          result_count?: number
          results?: Json
        }
        Relationships: []
      }
      hotel_search_sessions: {
        Row: {
          created_at: string
          display_currency: string
          expires_at: string
          hotel_count: number
          hotels: Json
          id: string
          provider_stats: Json
          search_params: Json
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_currency?: string
          expires_at?: string
          hotel_count?: number
          hotels?: Json
          id?: string
          provider_stats?: Json
          search_params?: Json
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_currency?: string
          expires_at?: string
          hotel_count?: number
          hotels?: Json
          id?: string
          provider_stats?: Json
          search_params?: Json
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotel_search_snapshot: {
        Row: {
          checkin: string
          checkout: string
          created_at: string
          currency: string | null
          free_cancellation: boolean | null
          hotel_uid: string
          id: string
          last_checked_at: string
          meal_basis: string | null
          min_price: number | null
          occupancy_key: string
          property_type: string | null
          raw_search_json: Json | null
          search_hotel_id: string | null
          stale_status: string | null
          updated_at: string
        }
        Insert: {
          checkin: string
          checkout: string
          created_at?: string
          currency?: string | null
          free_cancellation?: boolean | null
          hotel_uid: string
          id?: string
          last_checked_at?: string
          meal_basis?: string | null
          min_price?: number | null
          occupancy_key?: string
          property_type?: string | null
          raw_search_json?: Json | null
          search_hotel_id?: string | null
          stale_status?: string | null
          updated_at?: string
        }
        Update: {
          checkin?: string
          checkout?: string
          created_at?: string
          currency?: string | null
          free_cancellation?: boolean | null
          hotel_uid?: string
          id?: string
          last_checked_at?: string
          meal_basis?: string | null
          min_price?: number | null
          occupancy_key?: string
          property_type?: string | null
          raw_search_json?: Json | null
          search_hotel_id?: string | null
          stale_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hotel_static_cache: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          facilities_json: Json | null
          hero_image_url: string | null
          hotel_uid: string
          id: string
          images_json: Json | null
          latitude: number | null
          longitude: number | null
          name: string
          property_type: string | null
          rating: number | null
          source: string | null
          stars: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          facilities_json?: Json | null
          hero_image_url?: string | null
          hotel_uid: string
          id?: string
          images_json?: Json | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          property_type?: string | null
          rating?: number | null
          source?: string | null
          stars?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          facilities_json?: Json | null
          hero_image_url?: string | null
          hotel_uid?: string
          id?: string
          images_json?: Json | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          property_type?: string | null
          rating?: number | null
          source?: string | null
          stars?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      hotel_supplier_mappings: {
        Row: {
          city: string
          confidence: number
          country: string
          created_at: string
          hotel_name: string
          id: string
          internal_hotel_id: string
          latitude: number | null
          longitude: number | null
          supplier: string
          supplier_hotel_id: string
          updated_at: string
        }
        Insert: {
          city?: string
          confidence?: number
          country?: string
          created_at?: string
          hotel_name?: string
          id?: string
          internal_hotel_id: string
          latitude?: number | null
          longitude?: number | null
          supplier: string
          supplier_hotel_id: string
          updated_at?: string
        }
        Update: {
          city?: string
          confidence?: number
          country?: string
          created_at?: string
          hotel_name?: string
          id?: string
          internal_hotel_id?: string
          latitude?: number | null
          longitude?: number | null
          supplier?: string
          supplier_hotel_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hotels: {
        Row: {
          amenities: Json | null
          city: string
          created_at: string
          id: string
          image: string | null
          is_active: boolean | null
          name: string
          price: number | null
          rating: number | null
          reviews: number | null
          stars: number | null
        }
        Insert: {
          amenities?: Json | null
          city: string
          created_at?: string
          id?: string
          image?: string | null
          is_active?: boolean | null
          name: string
          price?: number | null
          rating?: number | null
          reviews?: number | null
          stars?: number | null
        }
        Update: {
          amenities?: Json | null
          city?: string
          created_at?: string
          id?: string
          image?: string | null
          is_active?: boolean | null
          name?: string
          price?: number | null
          rating?: number | null
          reviews?: number | null
          stars?: number | null
        }
        Relationships: []
      }
      itinerary_change_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          change_summary: string | null
          created_at: string
          id: string
          source: string
          trip_id: string
          version: number
        }
        Insert: {
          action_type?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          change_summary?: string | null
          created_at?: string
          id?: string
          source?: string
          trip_id: string
          version?: number
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          change_summary?: string | null
          created_at?: string
          id?: string
          source?: string
          trip_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_change_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "saved_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_errors: {
        Row: {
          details: Json | null
          detected_at: string
          error_type: string
          id: string
          resolved: boolean
          resolved_at: string | null
          source: string | null
          trip_id: string
          version: number | null
        }
        Insert: {
          details?: Json | null
          detected_at?: string
          error_type: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          source?: string | null
          trip_id: string
          version?: number | null
        }
        Update: {
          details?: Json | null
          detected_at?: string
          error_type?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          source?: string | null
          trip_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_errors_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "saved_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      market_currency_rules: {
        Row: {
          allowed_currencies: string[]
          country_code: string
          country_name: string
          created_at: string
          currency_picker_mode: string
          default_currency: string
          force_single_currency: boolean
          id: string
          updated_at: string
        }
        Insert: {
          allowed_currencies?: string[]
          country_code: string
          country_name?: string
          created_at?: string
          currency_picker_mode?: string
          default_currency?: string
          force_single_currency?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          allowed_currencies?: string[]
          country_code?: string
          country_name?: string
          created_at?: string
          currency_picker_mode?: string
          default_currency?: string
          force_single_currency?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_dedup: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          discount: string | null
          id: string
          is_active: boolean | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          discount?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          discount?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: []
      }
      platform_features: {
        Row: {
          category: string
          created_at: string
          default_enabled: boolean
          description: string | null
          display_name: string
          feature_key: string
          id: string
          is_active: boolean
          released_at: string
          required_plan_flag: string | null
          rollout_mode: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          display_name: string
          feature_key: string
          id?: string
          is_active?: boolean
          released_at?: string
          required_plan_flag?: string | null
          rollout_mode?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          display_name?: string
          feature_key?: string
          id?: string
          is_active?: boolean
          released_at?: string
          required_plan_flag?: string | null
          rollout_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_module_settings: {
        Row: {
          display_name: string
          is_enabled: boolean
          module_key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          display_name: string
          is_enabled?: boolean
          module_key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          display_name?: string
          is_enabled?: boolean
          module_key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      popular_routes: {
        Row: {
          airline: string | null
          created_at: string | null
          currency: string | null
          duration: string | null
          from_city: string | null
          from_code: string
          id: string
          last_searched_at: string | null
          lowest_price: number | null
          search_count: number | null
          stops: number | null
          to_city: string | null
          to_code: string
        }
        Insert: {
          airline?: string | null
          created_at?: string | null
          currency?: string | null
          duration?: string | null
          from_city?: string | null
          from_code: string
          id?: string
          last_searched_at?: string | null
          lowest_price?: number | null
          search_count?: number | null
          stops?: number | null
          to_city?: string | null
          to_code: string
        }
        Update: {
          airline?: string | null
          created_at?: string | null
          currency?: string | null
          duration?: string | null
          from_city?: string | null
          from_code?: string
          id?: string
          last_searched_at?: string | null
          lowest_price?: number | null
          search_count?: number | null
          stops?: number | null
          to_city?: string | null
          to_code?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          alert_type: string
          created_at: string
          currency: string
          current_price: number | null
          id: string
          last_checked_at: string | null
          route_from: string | null
          route_to: string | null
          status: string
          threshold_price: number
          travel_date: string | null
          triggered_at: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          currency?: string
          current_price?: number | null
          id?: string
          last_checked_at?: string | null
          route_from?: string | null
          route_to?: string | null
          status?: string
          threshold_price?: number
          travel_date?: string | null
          triggered_at?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          currency?: string
          current_price?: number | null
          id?: string
          last_checked_at?: string | null
          route_from?: string | null
          route_to?: string | null
          status?: string
          threshold_price?: number
          travel_date?: string | null
          triggered_at?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "saved_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allowed_currencies: string[] | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          billing_currency: string | null
          brand_color: string | null
          brand_color_locked: boolean
          company_address: string | null
          company_name: string | null
          created_at: string
          credit_limit: number
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean | null
          is_blocked: boolean | null
          logo_url: string | null
          parent_agent_id: string | null
          phone: string | null
          tenant_id: string | null
          trade_license: string | null
          updated_at: string | null
          user_id: string
          user_type: string | null
        }
        Insert: {
          allowed_currencies?: string[] | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          billing_currency?: string | null
          brand_color?: string | null
          brand_color_locked?: boolean
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          is_blocked?: boolean | null
          logo_url?: string | null
          parent_agent_id?: string | null
          phone?: string | null
          tenant_id?: string | null
          trade_license?: string | null
          updated_at?: string | null
          user_id: string
          user_type?: string | null
        }
        Update: {
          allowed_currencies?: string[] | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          billing_currency?: string | null
          brand_color?: string | null
          brand_color_locked?: boolean
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          is_blocked?: boolean | null
          logo_url?: string | null
          parent_agent_id?: string | null
          phone?: string | null
          tenant_id?: string | null
          trade_license?: string | null
          updated_at?: string | null
          user_id?: string
          user_type?: string | null
        }
        Relationships: []
      }
      provider_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          providers: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          providers?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          providers?: Json | null
        }
        Relationships: []
      }
      saved_passengers: {
        Row: {
          created_at: string
          dob: string | null
          first_name: string
          frequent_flyer: string | null
          id: string
          last_name: string
          nationality: string | null
          passport_country: string | null
          passport_expiry: string | null
          passport_number: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dob?: string | null
          first_name: string
          frequent_flyer?: string | null
          id?: string
          last_name: string
          nationality?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dob?: string | null
          first_name?: string
          frequent_flyer?: string | null
          id?: string
          last_name?: string
          nationality?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_trips: {
        Row: {
          created_at: string
          current_version: number
          destination: string | null
          duration_days: number | null
          id: string
          is_public: boolean | null
          itinerary: Json | null
          itinerary_code: string | null
          last_modified_by: string | null
          last_modified_source: string | null
          live_data: Json | null
          messages: Json | null
          origin: string | null
          share_token: string | null
          status: string | null
          title: string
          travelers: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_version?: number
          destination?: string | null
          duration_days?: number | null
          id?: string
          is_public?: boolean | null
          itinerary?: Json | null
          itinerary_code?: string | null
          last_modified_by?: string | null
          last_modified_source?: string | null
          live_data?: Json | null
          messages?: Json | null
          origin?: string | null
          share_token?: string | null
          status?: string | null
          title?: string
          travelers?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_version?: number
          destination?: string | null
          duration_days?: number | null
          id?: string
          is_public?: boolean | null
          itinerary?: Json | null
          itinerary_code?: string | null
          last_modified_by?: string | null
          last_modified_source?: string | null
          live_data?: Json | null
          messages?: Json | null
          origin?: string | null
          share_token?: string | null
          status?: string | null
          title?: string
          travelers?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      secret_access_logs: {
        Row: {
          accessed_by: string
          created_at: string
          function_name: string | null
          id: string
          provider: string
          secret_name: string
        }
        Insert: {
          accessed_by?: string
          created_at?: string
          function_name?: string | null
          id?: string
          provider?: string
          secret_name: string
        }
        Update: {
          accessed_by?: string
          created_at?: string
          function_name?: string | null
          id?: string
          provider?: string
          secret_name?: string
        }
        Relationships: []
      }
      skin_definitions: {
        Row: {
          audience_type: string
          created_at: string
          dashboard_layout: string
          default_design_tokens: Json
          default_modules: Json
          default_section_variants: Json
          description: string | null
          display_name: string
          homepage_mode: string
          id: string
          is_active: boolean
          is_premium: boolean
          preview_image_url: string | null
          primary_vertical: string | null
          required_plan_key: string | null
          results_surface_b2b: string | null
          results_surface_b2c: string | null
          search_surface_b2b: string | null
          search_surface_b2c: string | null
          skin_key: string
          sort_order: number
          updated_at: string
          variant_whitelist: Json
        }
        Insert: {
          audience_type: string
          created_at?: string
          dashboard_layout?: string
          default_design_tokens?: Json
          default_modules?: Json
          default_section_variants?: Json
          description?: string | null
          display_name: string
          homepage_mode?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          preview_image_url?: string | null
          primary_vertical?: string | null
          required_plan_key?: string | null
          results_surface_b2b?: string | null
          results_surface_b2c?: string | null
          search_surface_b2b?: string | null
          search_surface_b2c?: string | null
          skin_key: string
          sort_order?: number
          updated_at?: string
          variant_whitelist?: Json
        }
        Update: {
          audience_type?: string
          created_at?: string
          dashboard_layout?: string
          default_design_tokens?: Json
          default_modules?: Json
          default_section_variants?: Json
          description?: string | null
          display_name?: string
          homepage_mode?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          preview_image_url?: string | null
          primary_vertical?: string | null
          required_plan_key?: string | null
          results_surface_b2b?: string | null
          results_surface_b2c?: string | null
          search_surface_b2b?: string | null
          search_surface_b2c?: string | null
          skin_key?: string
          sort_order?: number
          updated_at?: string
          variant_whitelist?: Json
        }
        Relationships: []
      }
      smtp_configurations: {
        Row: {
          created_at: string
          daily_quota: number
          daily_sent: number
          email_mode: string
          encryption: string
          from_email: string | null
          from_name: string
          host: string | null
          id: string
          is_active: boolean
          label: string
          port: number
          quota_reset_at: string
          tenant_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          daily_quota?: number
          daily_sent?: number
          email_mode?: string
          encryption?: string
          from_email?: string | null
          from_name?: string
          host?: string | null
          id?: string
          is_active?: boolean
          label?: string
          port?: number
          quota_reset_at?: string
          tenant_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          daily_quota?: number
          daily_sent?: number
          email_mode?: string
          encryption?: string
          from_email?: string | null
          from_name?: string
          host?: string | null
          id?: string
          is_active?: boolean
          label?: string
          port?: number
          quota_reset_at?: string
          tenant_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smtp_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_airline_settings: {
        Row: {
          airline_code: string
          airline_name: string | null
          cabin_baggage: string | null
          cancellation_policy: string | null
          checkin_baggage: string | null
          created_at: string
          date_change_policy: string | null
          discount_policy: string | null
          from_code: string | null
          from_country: string | null
          id: string
          is_active: boolean | null
          name_change_policy: string | null
          no_show_policy: string | null
          scope_type: string
          to_code: string | null
          to_country: string | null
          updated_at: string | null
        }
        Insert: {
          airline_code: string
          airline_name?: string | null
          cabin_baggage?: string | null
          cancellation_policy?: string | null
          checkin_baggage?: string | null
          created_at?: string
          date_change_policy?: string | null
          discount_policy?: string | null
          from_code?: string | null
          from_country?: string | null
          id?: string
          is_active?: boolean | null
          name_change_policy?: string | null
          no_show_policy?: string | null
          scope_type?: string
          to_code?: string | null
          to_country?: string | null
          updated_at?: string | null
        }
        Update: {
          airline_code?: string
          airline_name?: string | null
          cabin_baggage?: string | null
          cancellation_policy?: string | null
          checkin_baggage?: string | null
          created_at?: string
          date_change_policy?: string | null
          discount_policy?: string | null
          from_code?: string | null
          from_country?: string | null
          id?: string
          is_active?: boolean | null
          name_change_policy?: string | null
          no_show_policy?: string | null
          scope_type?: string
          to_code?: string | null
          to_country?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      student_baggage_cache: {
        Row: {
          airline_code: string
          cabin_baggage: string | null
          cached_at: string
          checkin_baggage: string | null
          created_at: string
          expires_at: string
          fare_class: string
          from_code: string
          id: string
          source: string | null
          to_code: string
          updated_at: string | null
        }
        Insert: {
          airline_code: string
          cabin_baggage?: string | null
          cached_at?: string
          checkin_baggage?: string | null
          created_at?: string
          expires_at?: string
          fare_class?: string
          from_code: string
          id?: string
          source?: string | null
          to_code: string
          updated_at?: string | null
        }
        Update: {
          airline_code?: string
          cabin_baggage?: string | null
          cached_at?: string
          checkin_baggage?: string | null
          created_at?: string
          expires_at?: string
          fare_class?: string
          from_code?: string
          id?: string
          source?: string | null
          to_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sub_agent_earnings: {
        Row: {
          agent_user_id: string
          base_cost: number
          booking_id: string
          created_at: string
          id: string
          markup_amount: number
          status: string
          sub_agent_user_id: string
        }
        Insert: {
          agent_user_id: string
          base_cost?: number
          booking_id: string
          created_at?: string
          id?: string
          markup_amount?: number
          status?: string
          sub_agent_user_id: string
        }
        Update: {
          agent_user_id?: string
          base_cost?: number
          booking_id?: string
          created_at?: string
          id?: string
          markup_amount?: number
          status?: string
          sub_agent_user_id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_internal_note: boolean
          sender_type: string
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          sender_type: string
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          sender_type?: string
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          message: string
          priority: string
          related_booking_id: string | null
          resolved_at: string | null
          source_affiliate_id: string | null
          source_tenant_id: string | null
          source_url: string | null
          status: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          message: string
          priority?: string
          related_booking_id?: string | null
          resolved_at?: string | null
          source_affiliate_id?: string | null
          source_tenant_id?: string | null
          source_url?: string | null
          status?: string
          subject: string
          ticket_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          message?: string
          priority?: string
          related_booking_id?: string | null
          resolved_at?: string | null
          source_affiliate_id?: string | null
          source_tenant_id?: string | null
          source_url?: string | null
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_source_affiliate_id_fkey"
            columns: ["source_affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_credit_ledger: {
        Row: {
          amount_charged: number
          charged_from: string
          created_at: string
          id: string
          metadata: Json | null
          operation: string
          pool_balance_after: number | null
          prompt_summary: string | null
          result_reference: string | null
          tenant_id: string
          topup_balance_after: number | null
          user_id: string | null
        }
        Insert: {
          amount_charged: number
          charged_from: string
          created_at?: string
          id?: string
          metadata?: Json | null
          operation: string
          pool_balance_after?: number | null
          prompt_summary?: string | null
          result_reference?: string | null
          tenant_id: string
          topup_balance_after?: number | null
          user_id?: string | null
        }
        Update: {
          amount_charged?: number
          charged_from?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          operation?: string
          pool_balance_after?: number | null
          prompt_summary?: string | null
          result_reference?: string | null
          tenant_id?: string
          topup_balance_after?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_credit_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_credits: {
        Row: {
          created_at: string
          id: string
          last_charged_at: string | null
          monthly_allowance: number
          period_end: string
          period_start: string
          tenant_id: string
          top_up_balance: number
          total_lifetime_used: number
          updated_at: string
          used_this_period: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_charged_at?: string | null
          monthly_allowance?: number
          period_end?: string
          period_start?: string
          tenant_id: string
          top_up_balance?: number
          total_lifetime_used?: number
          updated_at?: string
          used_this_period?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_charged_at?: string | null
          monthly_allowance?: number
          period_end?: string
          period_start?: string
          tenant_id?: string
          top_up_balance?: number
          total_lifetime_used?: number
          updated_at?: string
          used_this_period?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string | null
          rate_limit_per_minute: number | null
          tenant_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          rate_limit_per_minute?: number | null
          tenant_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          rate_limit_per_minute?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_api_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          provider: string
          settings: Json | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider: string
          settings?: Json | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          settings?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_status: {
        Row: {
          acknowledged: boolean
          created_at: string
          enabled: boolean
          enabled_at: string | null
          enabled_by: string | null
          feature_key: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          feature_key: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          feature_key?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_status_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "platform_features"
            referencedColumns: ["feature_key"]
          },
          {
            foreignKeyName: "tenant_feature_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_page_composition: {
        Row: {
          block_instances: Json
          created_at: string
          id: string
          is_published: boolean
          last_ai_edit_at: string | null
          last_edited_by: string | null
          locked_block_keys: string[]
          meta_description: string | null
          page_slug: string
          page_title: string | null
          published_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          block_instances?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          last_ai_edit_at?: string | null
          last_edited_by?: string | null
          locked_block_keys?: string[]
          meta_description?: string | null
          page_slug: string
          page_title?: string | null
          published_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          block_instances?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          last_ai_edit_at?: string | null
          last_edited_by?: string | null
          locked_block_keys?: string[]
          meta_description?: string | null
          page_slug?: string
          page_title?: string | null
          published_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_page_composition_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          provider: string
          settings: Json | null
          supported_currencies: string[] | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider: string
          settings?: Json | null
          supported_currencies?: string[] | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          settings?: Json | null
          supported_currencies?: string[] | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_plan_subscriptions: {
        Row: {
          amount_usd: number
          billing_cycle: string
          created_at: string
          created_by: string | null
          currency: string
          expires_at: string
          id: string
          is_renewal: boolean
          notes: string | null
          plan_key: string
          source: string
          starts_at: string
          tenant_id: string
          wallet_transaction_id: string | null
        }
        Insert: {
          amount_usd?: number
          billing_cycle?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at: string
          id?: string
          is_renewal?: boolean
          notes?: string | null
          plan_key: string
          source?: string
          starts_at?: string
          tenant_id: string
          wallet_transaction_id?: string | null
        }
        Update: {
          amount_usd?: number
          billing_cycle?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string
          id?: string
          is_renewal?: boolean
          notes?: string | null
          plan_key?: string
          source?: string
          starts_at?: string
          tenant_id?: string
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_plan_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_plan_subscriptions_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_policies: {
        Row: {
          created_at: string
          draft_md: string | null
          generation_input: Json | null
          generation_model: string | null
          id: string
          last_generated_at: string | null
          last_generated_by: string | null
          policy_kind: string
          published_at: string | null
          published_by: string | null
          published_md: string | null
          show_in_footer: boolean
          slug: string
          sort_order: number
          status: string
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          draft_md?: string | null
          generation_input?: Json | null
          generation_model?: string | null
          id?: string
          last_generated_at?: string | null
          last_generated_by?: string | null
          policy_kind: string
          published_at?: string | null
          published_by?: string | null
          published_md?: string | null
          show_in_footer?: boolean
          slug: string
          sort_order?: number
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          draft_md?: string | null
          generation_input?: Json | null
          generation_model?: string | null
          id?: string
          last_generated_at?: string | null
          last_generated_by?: string | null
          policy_kind?: string
          published_at?: string | null
          published_by?: string | null
          published_md?: string | null
          show_in_footer?: boolean
          slug?: string
          sort_order?: number
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_site_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          event_type: string
          id: string
          page_path: string
          page_title: string | null
          referrer: string | null
          referrer_host: string | null
          session_id: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          referrer_host?: string | null
          session_id?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          referrer_host?: string | null
          session_id?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_site_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_site_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          design_tokens: Json | null
          enabled_modules: Json | null
          id: string
          label: string
          notes: string | null
          page_composition: Json | null
          section_variants: Json | null
          skin_key: string | null
          tenant_id: string
          trigger_source: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          design_tokens?: Json | null
          enabled_modules?: Json | null
          id?: string
          label: string
          notes?: string | null
          page_composition?: Json | null
          section_variants?: Json | null
          skin_key?: string | null
          tenant_id: string
          trigger_source?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          design_tokens?: Json | null
          enabled_modules?: Json | null
          id?: string
          label?: string
          notes?: string | null
          page_composition?: Json | null
          section_variants?: Json | null
          skin_key?: string | null
          tenant_id?: string
          trigger_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_site_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_skin_config: {
        Row: {
          accent_color: string | null
          animation_level: string | null
          background_color: string | null
          border_radius: string | null
          brand_kit_extracted_at: string | null
          button_style: string | null
          created_at: string
          density: string | null
          design_token_overrides: Json
          enabled_modules: Json
          font_body: string | null
          font_heading: string | null
          id: string
          image_treatment: string | null
          last_ai_rebuild_at: string | null
          locked_content: Json
          locked_variants: Json
          primary_color: string | null
          section_variant_overrides: Json
          skin_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          animation_level?: string | null
          background_color?: string | null
          border_radius?: string | null
          brand_kit_extracted_at?: string | null
          button_style?: string | null
          created_at?: string
          density?: string | null
          design_token_overrides?: Json
          enabled_modules?: Json
          font_body?: string | null
          font_heading?: string | null
          id?: string
          image_treatment?: string | null
          last_ai_rebuild_at?: string | null
          locked_content?: Json
          locked_variants?: Json
          primary_color?: string | null
          section_variant_overrides?: Json
          skin_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          animation_level?: string | null
          background_color?: string | null
          border_radius?: string | null
          brand_kit_extracted_at?: string | null
          button_style?: string | null
          created_at?: string
          density?: string | null
          design_token_overrides?: Json
          enabled_modules?: Json
          font_body?: string | null
          font_heading?: string | null
          id?: string
          image_treatment?: string | null
          last_ai_rebuild_at?: string | null
          locked_content?: Json
          locked_variants?: Json
          primary_color?: string | null
          section_variant_overrides?: Json
          skin_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_skin_config_skin_key_fkey"
            columns: ["skin_key"]
            isOneToOne: false
            referencedRelation: "skin_definitions"
            referencedColumns: ["skin_key"]
          },
          {
            foreignKeyName: "tenant_skin_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          allowed_products: string[]
          auto_blog_enabled: boolean
          b2b_landing_slug: string
          created_at: string
          domain: string | null
          id: string
          is_active: boolean | null
          module_overrides: Json
          name: string
          plan_auto_renew: boolean
          plan_billing_cycle: string
          plan_expires_at: string | null
          plan_key: string | null
          plan_started_at: string | null
          provider_group_id: string | null
          settings: Json | null
          show_partner_cta_on_home: boolean
          whitelabel_enabled: boolean
        }
        Insert: {
          allowed_products?: string[]
          auto_blog_enabled?: boolean
          b2b_landing_slug?: string
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean | null
          module_overrides?: Json
          name: string
          plan_auto_renew?: boolean
          plan_billing_cycle?: string
          plan_expires_at?: string | null
          plan_key?: string | null
          plan_started_at?: string | null
          provider_group_id?: string | null
          settings?: Json | null
          show_partner_cta_on_home?: boolean
          whitelabel_enabled?: boolean
        }
        Update: {
          allowed_products?: string[]
          auto_blog_enabled?: boolean
          b2b_landing_slug?: string
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean | null
          module_overrides?: Json
          name?: string
          plan_auto_renew?: boolean
          plan_billing_cycle?: string
          plan_expires_at?: string | null
          plan_key?: string | null
          plan_started_at?: string | null
          provider_group_id?: string | null
          settings?: Json | null
          show_partner_cta_on_home?: boolean
          whitelabel_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "b2b_plans"
            referencedColumns: ["plan_key"]
          },
          {
            foreignKeyName: "tenants_provider_group_id_fkey"
            columns: ["provider_group_id"]
            isOneToOne: false
            referencedRelation: "provider_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          rating: number | null
          role: string | null
          tenant_id: string | null
          text: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          rating?: number | null
          role?: string | null
          tenant_id?: string | null
          text: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          rating?: number | null
          role?: string | null
          tenant_id?: string | null
          text?: string
        }
        Relationships: []
      }
      ticket_requests: {
        Row: {
          admin_notes: string | null
          booking_id: string
          charges: number | null
          created_at: string
          id: string
          new_travel_date: string | null
          quote_amount: number | null
          reason: string | null
          refund_method: string | null
          status: string
          tenant_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          booking_id: string
          charges?: number | null
          created_at?: string
          id?: string
          new_travel_date?: string | null
          quote_amount?: number | null
          reason?: string | null
          refund_method?: string | null
          status?: string
          tenant_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          booking_id?: string
          charges?: number | null
          created_at?: string
          id?: string
          new_travel_date?: string | null
          quote_amount?: number | null
          reason?: string | null
          refund_method?: string | null
          status?: string
          tenant_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_inquiries: {
        Row: {
          admin_notes: string | null
          ai_itinerary: string | null
          budget: string | null
          created_at: string
          destination: string | null
          duration: string | null
          id: string
          interests: string | null
          source: string | null
          status: string
          travel_dates: string | null
          travelers: number | null
          updated_at: string
          visitor_email: string
          visitor_name: string
          visitor_phone: string | null
        }
        Insert: {
          admin_notes?: string | null
          ai_itinerary?: string | null
          budget?: string | null
          created_at?: string
          destination?: string | null
          duration?: string | null
          id?: string
          interests?: string | null
          source?: string | null
          status?: string
          travel_dates?: string | null
          travelers?: number | null
          updated_at?: string
          visitor_email?: string
          visitor_name?: string
          visitor_phone?: string | null
        }
        Update: {
          admin_notes?: string | null
          ai_itinerary?: string | null
          budget?: string | null
          created_at?: string
          destination?: string | null
          duration?: string | null
          id?: string
          interests?: string | null
          source?: string | null
          status?: string
          travel_dates?: string | null
          travelers?: number | null
          updated_at?: string
          visitor_email?: string
          visitor_name?: string
          visitor_phone?: string | null
        }
        Relationships: []
      }
      tour_product_cache: {
        Row: {
          age_bands: Json | null
          cached_at: string
          category: string | null
          currency: string
          destination: string
          detail_fetched: boolean
          duration: string | null
          expires_at: string | null
          highlights: string[] | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          last_verified_at: string | null
          modified_since_cursor: string | null
          places_covered: string[] | null
          price: number
          pricing_type: string
          product_code: string
          product_data: Json
          provider: string
          rating: number | null
          review_count: number | null
          short_description: string | null
          slug: string | null
          sync_source: string
          tags: string[] | null
          title: string
          updated_at: string | null
          vela_id: string | null
        }
        Insert: {
          age_bands?: Json | null
          cached_at?: string
          category?: string | null
          currency?: string
          destination?: string
          detail_fetched?: boolean
          duration?: string | null
          expires_at?: string | null
          highlights?: string[] | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          last_verified_at?: string | null
          modified_since_cursor?: string | null
          places_covered?: string[] | null
          price?: number
          pricing_type?: string
          product_code: string
          product_data?: Json
          provider?: string
          rating?: number | null
          review_count?: number | null
          short_description?: string | null
          slug?: string | null
          sync_source?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          vela_id?: string | null
        }
        Update: {
          age_bands?: Json | null
          cached_at?: string
          category?: string | null
          currency?: string
          destination?: string
          detail_fetched?: boolean
          duration?: string | null
          expires_at?: string | null
          highlights?: string[] | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          last_verified_at?: string | null
          modified_since_cursor?: string | null
          places_covered?: string[] | null
          price?: number
          pricing_type?: string
          product_code?: string
          product_data?: Json
          provider?: string
          rating?: number | null
          review_count?: number | null
          short_description?: string | null
          slug?: string | null
          sync_source?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          vela_id?: string | null
        }
        Relationships: []
      }
      tour_search_cache: {
        Row: {
          cache_key: string
          created_at: string
          currency: string
          destination_id: string | null
          expires_at: string
          id: string
          product_codes: string[]
          provider: string
          result_count: number
          results: Json
          search_query: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          currency?: string
          destination_id?: string | null
          expires_at?: string
          id?: string
          product_codes?: string[]
          provider?: string
          result_count?: number
          results?: Json
          search_query?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          currency?: string
          destination_id?: string | null
          expires_at?: string
          id?: string
          product_codes?: string[]
          provider?: string
          result_count?: number
          results?: Json
          search_query?: string
        }
        Relationships: []
      }
      tour_sync_state: {
        Row: {
          completed_at: string | null
          destination_id: string
          destination_name: string
          error_count: number
          id: string
          last_error: string | null
          last_modified_since_at: string | null
          last_product_code: string | null
          last_search_hit_at: string | null
          modified_since_cursor: string | null
          priority: number
          product_codes_done: string[]
          product_codes_pending: string[]
          products_detailed: number
          refresh_tier: string | null
          search_complete: boolean
          search_cursor: number
          search_hit_count: number | null
          started_at: string | null
          status: string
          total_products_found: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          destination_id: string
          destination_name?: string
          error_count?: number
          id?: string
          last_error?: string | null
          last_modified_since_at?: string | null
          last_product_code?: string | null
          last_search_hit_at?: string | null
          modified_since_cursor?: string | null
          priority?: number
          product_codes_done?: string[]
          product_codes_pending?: string[]
          products_detailed?: number
          refresh_tier?: string | null
          search_complete?: boolean
          search_cursor?: number
          search_hit_count?: number | null
          started_at?: string | null
          status?: string
          total_products_found?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          destination_id?: string
          destination_name?: string
          error_count?: number
          id?: string
          last_error?: string | null
          last_modified_since_at?: string | null
          last_product_code?: string | null
          last_search_hit_at?: string | null
          modified_since_cursor?: string | null
          priority?: number
          product_codes_done?: string[]
          product_codes_pending?: string[]
          products_detailed?: number
          refresh_tier?: string | null
          search_complete?: boolean
          search_cursor?: number
          search_hit_count?: number | null
          started_at?: string | null
          status?: string
          total_products_found?: number
          updated_at?: string
        }
        Relationships: []
      }
      tours: {
        Row: {
          category: string | null
          created_at: string
          destination: string
          duration: string | null
          highlights: Json | null
          id: string
          image: string | null
          is_active: boolean | null
          name: string
          price: number | null
          rating: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          destination: string
          duration?: string | null
          highlights?: Json | null
          id?: string
          image?: string | null
          is_active?: boolean | null
          name: string
          price?: number | null
          rating?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          destination?: string
          duration?: string | null
          highlights?: Json | null
          id?: string
          image?: string | null
          is_active?: boolean | null
          name?: string
          price?: number | null
          rating?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transfer_route_cache: {
        Row: {
          bookability: string
          city: string | null
          confidence_score: number | null
          country: string | null
          created_at: string
          currency: string
          destination_id: string | null
          dropoff_code: string | null
          dropoff_name: string | null
          dropoff_type: string
          duration_minutes: number | null
          expires_at: string
          id: string
          is_mandatory: boolean | null
          is_roundtrip: boolean | null
          luggage_class: string | null
          mode: string | null
          passenger_count: number | null
          per_person_price: number | null
          pickup_code: string | null
          pickup_name: string | null
          pickup_type: string
          price_accuracy: string
          pricing_source: string
          recommendation_text: string | null
          resolved_data: Json | null
          route_key: string
          tags: string[] | null
          time_bucket: string | null
          total_price: number
          transfer_type: string | null
          updated_at: string
          vehicle_class: string | null
        }
        Insert: {
          bookability?: string
          city?: string | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          currency?: string
          destination_id?: string | null
          dropoff_code?: string | null
          dropoff_name?: string | null
          dropoff_type?: string
          duration_minutes?: number | null
          expires_at?: string
          id?: string
          is_mandatory?: boolean | null
          is_roundtrip?: boolean | null
          luggage_class?: string | null
          mode?: string | null
          passenger_count?: number | null
          per_person_price?: number | null
          pickup_code?: string | null
          pickup_name?: string | null
          pickup_type?: string
          price_accuracy?: string
          pricing_source?: string
          recommendation_text?: string | null
          resolved_data?: Json | null
          route_key: string
          tags?: string[] | null
          time_bucket?: string | null
          total_price?: number
          transfer_type?: string | null
          updated_at?: string
          vehicle_class?: string | null
        }
        Update: {
          bookability?: string
          city?: string | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string
          currency?: string
          destination_id?: string | null
          dropoff_code?: string | null
          dropoff_name?: string | null
          dropoff_type?: string
          duration_minutes?: number | null
          expires_at?: string
          id?: string
          is_mandatory?: boolean | null
          is_roundtrip?: boolean | null
          luggage_class?: string | null
          mode?: string | null
          passenger_count?: number | null
          per_person_price?: number | null
          pickup_code?: string | null
          pickup_name?: string | null
          pickup_type?: string
          price_accuracy?: string
          pricing_source?: string
          recommendation_text?: string | null
          resolved_data?: Json | null
          route_key?: string
          tags?: string[] | null
          time_bucket?: string | null
          total_price?: number
          transfer_type?: string | null
          updated_at?: string
          vehicle_class?: string | null
        }
        Relationships: []
      }
      trip_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_collaborators_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "saved_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_finalization_requests: {
        Row: {
          admin_notes: string
          assigned_to: string | null
          conversation_summary: string
          created_at: string
          currency: string
          destination: string
          duration_days: number
          estimated_total: number
          id: string
          is_large_group: boolean
          itinerary_data: Json
          passenger_email: string
          passenger_name: string
          passenger_phone: string
          status: string
          tenant_id: string | null
          travelers: number
          trip_title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string
          assigned_to?: string | null
          conversation_summary?: string
          created_at?: string
          currency?: string
          destination?: string
          duration_days?: number
          estimated_total?: number
          id?: string
          is_large_group?: boolean
          itinerary_data?: Json
          passenger_email?: string
          passenger_name?: string
          passenger_phone?: string
          status?: string
          tenant_id?: string | null
          travelers?: number
          trip_title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string
          assigned_to?: string | null
          conversation_summary?: string
          created_at?: string
          currency?: string
          destination?: string
          duration_days?: number
          estimated_total?: number
          id?: string
          is_large_group?: boolean
          itinerary_data?: Json
          passenger_email?: string
          passenger_name?: string
          passenger_phone?: string
          status?: string
          tenant_id?: string | null
          travelers?: number
          trip_title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trip_generation_jobs: {
        Row: {
          completed_at: string | null
          confidence_score: number | null
          created_at: string
          error_message: string | null
          id: string
          progress: string | null
          quality_metadata: Json | null
          quality_score: number | null
          request_payload: Json
          result: Json | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          progress?: string | null
          quality_metadata?: Json | null
          quality_score?: number | null
          request_payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          progress?: string | null
          quality_metadata?: Json | null
          quality_score?: number | null
          request_payload?: Json
          result?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_insights: {
        Row: {
          budget_currency: string | null
          budget_total: number | null
          cabin_class: string | null
          created_at: string
          destination: string
          duration_days: number
          hotel_stars: number | null
          id: string
          month: number | null
          origin: string
          season: string | null
          selection_priority: string | null
          tenant_id: string | null
          travel_style: string | null
          travel_type: string | null
          travelers: number
          was_finalized: boolean | null
        }
        Insert: {
          budget_currency?: string | null
          budget_total?: number | null
          cabin_class?: string | null
          created_at?: string
          destination?: string
          duration_days?: number
          hotel_stars?: number | null
          id?: string
          month?: number | null
          origin?: string
          season?: string | null
          selection_priority?: string | null
          tenant_id?: string | null
          travel_style?: string | null
          travel_type?: string | null
          travelers?: number
          was_finalized?: boolean | null
        }
        Update: {
          budget_currency?: string | null
          budget_total?: number | null
          cabin_class?: string | null
          created_at?: string
          destination?: string
          duration_days?: number
          hotel_stars?: number | null
          id?: string
          month?: number | null
          origin?: string
          season?: string | null
          selection_priority?: string | null
          tenant_id?: string | null
          travel_style?: string | null
          travel_type?: string | null
          travelers?: number
          was_finalized?: boolean | null
        }
        Relationships: []
      }
      trip_itinerary_embeddings: {
        Row: {
          budget_currency: string | null
          budget_total: number | null
          cabin_class: string | null
          created_at: string
          destination: string
          duration_days: number
          embedding: string | null
          id: string
          itinerary_json: Json
          itinerary_summary: string
          origin: string
          quality_score: number | null
          tenant_id: string | null
          travel_style: string | null
          travel_type: string | null
          travelers: number
          trip_signature: string
          usage_count: number | null
        }
        Insert: {
          budget_currency?: string | null
          budget_total?: number | null
          cabin_class?: string | null
          created_at?: string
          destination?: string
          duration_days?: number
          embedding?: string | null
          id?: string
          itinerary_json?: Json
          itinerary_summary?: string
          origin?: string
          quality_score?: number | null
          tenant_id?: string | null
          travel_style?: string | null
          travel_type?: string | null
          travelers?: number
          trip_signature?: string
          usage_count?: number | null
        }
        Update: {
          budget_currency?: string | null
          budget_total?: number | null
          cabin_class?: string | null
          created_at?: string
          destination?: string
          duration_days?: number
          embedding?: string | null
          id?: string
          itinerary_json?: Json
          itinerary_summary?: string
          origin?: string
          quality_score?: number | null
          tenant_id?: string | null
          travel_style?: string | null
          travel_type?: string | null
          travelers?: number
          trip_signature?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      trip_itinerary_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          job_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          job_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          job_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_itinerary_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "trip_generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_learning_insights: {
        Row: {
          applied_at: string | null
          category: string | null
          confidence: number | null
          created_at: string
          data: Json | null
          description: string | null
          expires_at: string | null
          id: string
          insight_type: string
          priority: string | null
          sample_size: number | null
          status: string | null
          title: string
        }
        Insert: {
          applied_at?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          data?: Json | null
          description?: string | null
          expires_at?: string | null
          id?: string
          insight_type: string
          priority?: string | null
          sample_size?: number | null
          status?: string | null
          title: string
        }
        Update: {
          applied_at?: string | null
          category?: string | null
          confidence?: number | null
          created_at?: string
          data?: Json | null
          description?: string | null
          expires_at?: string | null
          id?: string
          insight_type?: string
          priority?: string | null
          sample_size?: number | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      trip_search_cache: {
        Row: {
          cache_key: string
          cached_at: string
          created_at: string
          expires_at: string
          id: string
          result_count: number
          results: Json
          search_params: Json
          search_type: string
        }
        Insert: {
          cache_key: string
          cached_at?: string
          created_at?: string
          expires_at: string
          id?: string
          result_count?: number
          results?: Json
          search_params?: Json
          search_type: string
        }
        Update: {
          cache_key?: string
          cached_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          result_count?: number
          results?: Json
          search_params?: Json
          search_type?: string
        }
        Relationships: []
      }
      tripjack_cities: {
        Row: {
          city_name: string
          country_name: string | null
          created_at: string
          full_region_name: string | null
          id: number
          type: string | null
        }
        Insert: {
          city_name?: string
          country_name?: string | null
          created_at?: string
          full_region_name?: string | null
          id: number
          type?: string | null
        }
        Update: {
          city_name?: string
          country_name?: string | null
          created_at?: string
          full_region_name?: string | null
          id?: number
          type?: string | null
        }
        Relationships: []
      }
      tripjack_city_hotel_map: {
        Row: {
          city_name: string
          country_name: string
          hotel_count: number
          hotel_ids: string[]
          id: string
          updated_at: string
        }
        Insert: {
          city_name: string
          country_name?: string
          hotel_count?: number
          hotel_ids?: string[]
          id?: string
          updated_at?: string
        }
        Update: {
          city_name?: string
          country_name?: string
          hotel_count?: number
          hotel_ids?: string[]
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tripjack_hotels: {
        Row: {
          address: string | null
          city_code: string | null
          city_name: string | null
          contact: Json | null
          country_code: string | null
          country_name: string | null
          created_at: string
          description: Json | null
          facilities: Json | null
          hero_image_url: string | null
          image_url: string | null
          images: Json | null
          is_deleted: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          postal_code: string | null
          property_type: string | null
          rating: number | null
          state_name: string | null
          synced_at: string | null
          tj_hotel_id: number
          unica_id: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city_code?: string | null
          city_name?: string | null
          contact?: Json | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          description?: Json | null
          facilities?: Json | null
          hero_image_url?: string | null
          image_url?: string | null
          images?: Json | null
          is_deleted?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          postal_code?: string | null
          property_type?: string | null
          rating?: number | null
          state_name?: string | null
          synced_at?: string | null
          tj_hotel_id: number
          unica_id?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city_code?: string | null
          city_name?: string | null
          contact?: Json | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          description?: Json | null
          facilities?: Json | null
          hero_image_url?: string | null
          image_url?: string | null
          images?: Json | null
          is_deleted?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          postal_code?: string | null
          property_type?: string | null
          rating?: number | null
          state_name?: string | null
          synced_at?: string | null
          tj_hotel_id?: number
          unica_id?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tripjack_sync_state: {
        Row: {
          completed_at: string | null
          id: string
          next_cursor: string | null
          pages_processed: number
          started_at: string | null
          status: string
          sync_type: string
          total_cities_synced: number
          total_hotels_synced: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          next_cursor?: string | null
          pages_processed?: number
          started_at?: string | null
          status?: string
          sync_type?: string
          total_cities_synced?: number
          total_hotels_synced?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          next_cursor?: string | null
          pages_processed?: number
          started_at?: string | null
          status?: string
          sync_type?: string
          total_cities_synced?: number
          total_hotels_synced?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      viator_destination_map: {
        Row: {
          auto_learned: boolean | null
          city_name: string
          country: string
          created_at: string
          default_currency: string | null
          dest_id: string
          dest_type: string | null
          iata_code: string | null
          latitude: number | null
          longitude: number | null
          lookup_id: string | null
          parent_id: string | null
          region: string
          taxonomy_synced_at: string | null
          time_zone: string | null
        }
        Insert: {
          auto_learned?: boolean | null
          city_name: string
          country?: string
          created_at?: string
          default_currency?: string | null
          dest_id: string
          dest_type?: string | null
          iata_code?: string | null
          latitude?: number | null
          longitude?: number | null
          lookup_id?: string | null
          parent_id?: string | null
          region?: string
          taxonomy_synced_at?: string | null
          time_zone?: string | null
        }
        Update: {
          auto_learned?: boolean | null
          city_name?: string
          country?: string
          created_at?: string
          default_currency?: string | null
          dest_id?: string
          dest_type?: string | null
          iata_code?: string | null
          latitude?: number | null
          longitude?: number | null
          lookup_id?: string | null
          parent_id?: string | null
          region?: string
          taxonomy_synced_at?: string | null
          time_zone?: string | null
        }
        Relationships: []
      }
      visa_fetch_log: {
        Row: {
          fetched_at: string
          id: string
          next_refresh_at: string
          passport_country: string
          record_count: number | null
        }
        Insert: {
          fetched_at?: string
          id?: string
          next_refresh_at?: string
          passport_country: string
          record_count?: number | null
        }
        Update: {
          fetched_at?: string
          id?: string
          next_refresh_at?: string
          passport_country?: string
          record_count?: number | null
        }
        Relationships: []
      }
      visa_requirements: {
        Row: {
          destination_country: string
          destination_name: string | null
          fetched_at: string
          id: string
          passport_country: string
          visa_status: string
        }
        Insert: {
          destination_country: string
          destination_name?: string | null
          fetched_at?: string
          id?: string
          passport_country: string
          visa_status: string
        }
        Update: {
          destination_country?: string
          destination_name?: string | null
          fetched_at?: string
          id?: string
          passport_country?: string
          visa_status?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          actor_user_id: string | null
          amount: number
          booking_id: string | null
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          receipt_url: string | null
          reference: string | null
          status: string | null
          tenant_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          amount?: number
          booking_id?: string | null
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          receipt_url?: string | null
          reference?: string | null
          status?: string | null
          tenant_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          booking_id?: string | null
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          receipt_url?: string | null
          reference?: string | null
          status?: string | null
          tenant_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transfers: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          from_user_id: string
          id: string
          status: string
          to_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      hotels_catalogue: {
        Row: {
          canonical_id: string | null
          city_name: string | null
          country_name: string | null
          image_url: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          rating: number | null
          snapshot_at: string | null
          supplier: string | null
          supplier_hotel_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_grant_tenant_plan: {
        Args: {
          p_expires_at: string
          p_notes?: string
          p_plan_key: string
          p_tenant_id: string
        }
        Returns: Json
      }
      approve_wallet_deposit: {
        Args: { p_admin_note?: string; p_transaction_id: string }
        Returns: Json
      }
      backfill_legacy_whitelabel_to_enterprise: { Args: never; Returns: Json }
      backfill_tour_highlights: { Args: { batch_size?: number }; Returns: Json }
      backfill_tripjack_city_map: { Args: never; Returns: Json }
      charge_tenant_ai_credits: {
        Args: {
          _amount: number
          _metadata?: Json
          _operation: string
          _prompt_summary?: string
          _result_reference?: string
          _tenant_id: string
          _user_id?: string
        }
        Returns: Json
      }
      cleanup_flight_search_cache: { Args: never; Returns: undefined }
      cleanup_hotel_search_cache: { Args: never; Returns: undefined }
      cleanup_hotel_search_sessions: { Args: never; Returns: undefined }
      cleanup_old_records: { Args: never; Returns: undefined }
      cleanup_tour_cache: { Args: never; Returns: undefined }
      cleanup_transfer_cache: { Args: never; Returns: undefined }
      cleanup_trip_search_cache: { Args: never; Returns: undefined }
      create_tenant_snapshot: {
        Args: {
          _label: string
          _notes?: string
          _tenant_id: string
          _trigger_source?: string
        }
        Returns: string
      }
      cron_refresh_hotels_catalogue: { Args: never; Returns: undefined }
      fix_tour_currency_from_schedule: {
        Args: { batch_size?: number }
        Returns: Json
      }
      fix_tour_destinations: { Args: { batch_size?: number }; Returns: Json }
      generate_affiliate_code: { Args: never; Returns: string }
      generate_tenant_api_key: { Args: never; Returns: string }
      generate_vela_id: { Args: { p_product_code: string }; Returns: string }
      get_admin_tenant_id: { Args: { _user_id: string }; Returns: string }
      get_custom_site_pages: {
        Args: { _site_id: string }
        Returns: {
          id: string
          is_home: boolean
          is_system: boolean
          meta_description: string
          meta_title: string
          sections: Json
          site_id: string
          slug: string
          sort_order: number
          title: string
        }[]
      }
      get_hotel_freshness: {
        Args: { p_checkin: string; p_last_checked_at: string }
        Returns: string
      }
      get_my_tenant_modules: { Args: never; Returns: Json }
      get_plan_price: {
        Args: { p_currency: string; p_plan_key: string; p_price_kind: string }
        Returns: Json
      }
      get_profile_privileged_fields: {
        Args: { _user_id: string }
        Returns: {
          approval_status: string
          credit_limit: number
          is_approved: boolean
          is_blocked: boolean
          user_type: string
        }[]
      }
      get_provider_credential_status: {
        Args: { p_provider: string }
        Returns: Json
      }
      get_tenant_ai_credits: { Args: { _tenant_id: string }; Returns: Json }
      get_tenant_ai_grant: { Args: { _tenant_id: string }; Returns: number }
      get_tenant_modules: { Args: { _tenant_id: string }; Returns: Json }
      get_tenant_wallet_balance: {
        Args: { _tenant_id: string }
        Returns: number
      }
      has_provider_secret: { Args: { p_name: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_affiliate_owner: { Args: { _affiliate_id: string }; Returns: boolean }
      is_feature_enabled_for_tenant: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
      is_tenant_admin_of: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
      match_trip_itineraries: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          budget_currency: string
          budget_total: number
          destination: string
          duration_days: number
          id: string
          itinerary_json: Json
          itinerary_summary: string
          origin: string
          similarity: number
          travel_style: string
          travel_type: string
          travelers: number
        }[]
      }
      read_provider_secret: { Args: { p_name: string }; Returns: string }
      refresh_all_tenant_ai_credits: { Args: never; Returns: Json }
      refresh_hotel_popularity: { Args: never; Returns: undefined }
      refresh_hotels_catalogue: {
        Args: { p_concurrent?: boolean }
        Returns: Json
      }
      refresh_tenant_ai_credits: { Args: { _tenant_id: string }; Returns: Json }
      reject_wallet_deposit: {
        Args: { p_reason?: string; p_transaction_id: string }
        Returns: Json
      }
      resolve_custom_site_for_host: {
        Args: { _host: string }
        Returns: {
          accent_color: string
          contact_email: string
          contact_phone: string
          contact_whatsapp: string
          favicon_url: string
          font_body: string
          font_heading: string
          is_published: boolean
          logo_url: string
          primary_color: string
          published_at: string
          show_flights: boolean
          show_hotels: boolean
          show_tours: boolean
          show_transfers: boolean
          site_id: string
          site_name: string
          social_links: Json
          tagline: string
          tenant_id: string
        }[]
      }
      resolve_hotel_by_name: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          canonical_id: string
          city_name: string
          country_name: string
          image_url: string
          name: string
          rating: number
          supplier: string
          supplier_hotel_id: string
        }[]
      }
      save_provider_credentials: {
        Args: { p_credentials: Json; p_provider: string }
        Returns: undefined
      }
      search_hotels_catalogue: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          city_name: string
          country_name: string
          image_url: string
          name: string
          property_type: string
          rating: number
          tj_hotel_id: number
          unica_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      subscribe_tenant_plan:
        | {
            Args: {
              p_billing_cycle?: string
              p_plan_key: string
              p_tenant_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_billing_cycle?: string
              p_currency?: string
              p_plan_key: string
              p_tenant_id: string
            }
            Returns: Json
          }
      tenant_can_use_blog: {
        Args: { _feature?: string; _tenant_id: string }
        Returns: boolean
      }
      upsert_baggage_cache: {
        Args: {
          p_airline_code: string
          p_cabin_baggage: string
          p_checkin_baggage: string
          p_fare_class: string
          p_from_code: string
          p_is_student?: boolean
          p_source?: string
          p_to_code: string
        }
        Returns: undefined
      }
      upsert_provider_secret: {
        Args: { p_description?: string; p_name: string; p_secret: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["super_admin", "admin", "moderator", "user"],
    },
  },
} as const
