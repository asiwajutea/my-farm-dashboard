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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          detail: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          amount: number
          basis_amount: number
          created_at: string
          from_user_id: string
          generation: number
          id: string
          pct: number
          source: Database["public"]["Enums"]["affiliate_source"]
          source_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          basis_amount: number
          created_at?: string
          from_user_id: string
          generation: number
          id?: string
          pct: number
          source: Database["public"]["Enums"]["affiliate_source"]
          source_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          basis_amount?: number
          created_at?: string
          from_user_id?: string
          generation?: number
          id?: string
          pct?: number
          source?: Database["public"]["Enums"]["affiliate_source"]
          source_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          aff_basis: Database["public"]["Enums"]["aff_basis"]
          aff_gen1_pct: number
          aff_gen2_pct: number
          aff_gen3_pct: number
          aff_maint_gen1_pct: number
          aff_maint_gen2_pct: number
          aff_maint_gen3_pct: number
          cycle_base_reward_pct: number
          cycle_duration_days: number
          id: boolean
          maint_fee_day: number
          maint_fee_seed: number
          maint_message: string
          maint_mode_global: boolean
          maint_pages: Json
          max_cycle_seed: number
          min_cycle_seed: number
          min_deposit_seed: number
          min_withdraw_seed: number
          p2p_fee_pct: number
          payout_anchor: string
          payout_lock_enabled: boolean
          payout_timezone: string
          referral_bonus_pct: number
          seed_to_usdt: number
          ticker_enabled: boolean
          ticker_items: Json
          updated_at: string
          withdraw_fee_pct: number
        }
        Insert: {
          aff_basis?: Database["public"]["Enums"]["aff_basis"]
          aff_gen1_pct?: number
          aff_gen2_pct?: number
          aff_gen3_pct?: number
          aff_maint_gen1_pct?: number
          aff_maint_gen2_pct?: number
          aff_maint_gen3_pct?: number
          cycle_base_reward_pct?: number
          cycle_duration_days?: number
          id?: boolean
          maint_fee_day?: number
          maint_fee_seed?: number
          maint_message?: string
          maint_mode_global?: boolean
          maint_pages?: Json
          max_cycle_seed?: number
          min_cycle_seed?: number
          min_deposit_seed?: number
          min_withdraw_seed?: number
          p2p_fee_pct?: number
          payout_anchor?: string
          payout_lock_enabled?: boolean
          payout_timezone?: string
          referral_bonus_pct?: number
          seed_to_usdt?: number
          ticker_enabled?: boolean
          ticker_items?: Json
          updated_at?: string
          withdraw_fee_pct?: number
        }
        Update: {
          aff_basis?: Database["public"]["Enums"]["aff_basis"]
          aff_gen1_pct?: number
          aff_gen2_pct?: number
          aff_gen3_pct?: number
          aff_maint_gen1_pct?: number
          aff_maint_gen2_pct?: number
          aff_maint_gen3_pct?: number
          cycle_base_reward_pct?: number
          cycle_duration_days?: number
          id?: boolean
          maint_fee_day?: number
          maint_fee_seed?: number
          maint_message?: string
          maint_mode_global?: boolean
          maint_pages?: Json
          max_cycle_seed?: number
          min_cycle_seed?: number
          min_deposit_seed?: number
          min_withdraw_seed?: number
          p2p_fee_pct?: number
          payout_anchor?: string
          payout_lock_enabled?: boolean
          payout_timezone?: string
          referral_bonus_pct?: number
          seed_to_usdt?: number
          ticker_enabled?: boolean
          ticker_items?: Json
          updated_at?: string
          withdraw_fee_pct?: number
        }
        Relationships: []
      }
      boosters: {
        Row: {
          active: boolean
          code: string
          cost_seed: number
          created_at: string
          duration_hours: number
          id: string
          label: string
          reward_bps: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          cost_seed?: number
          created_at?: string
          duration_hours: number
          id?: string
          label: string
          reward_bps: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          cost_seed?: number
          created_at?: string
          duration_hours?: number
          id?: string
          label?: string
          reward_bps?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          amount: number
          coupon_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          amount: number
          coupon_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          coupon_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          created_by: string | null
          currency: string
          expires_at: string | null
          id: string
          max_redemptions: number
          updated_at: string
          used_redemptions: number
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          max_redemptions?: number
          updated_at?: string
          used_redemptions?: number
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          max_redemptions?: number
          updated_at?: string
          used_redemptions?: number
        }
        Relationships: []
      }
      cycles: {
        Row: {
          amount: number
          booster_id: string | null
          created_at: string
          duration_hours: number
          id: string
          matures_at: string
          reaped_at: string | null
          reward_bps: number
          started_at: string
          status: Database["public"]["Enums"]["cycle_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booster_id?: string | null
          created_at?: string
          duration_hours: number
          id?: string
          matures_at: string
          reaped_at?: string | null
          reward_bps: number
          started_at?: string
          status?: Database["public"]["Enums"]["cycle_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booster_id?: string | null
          created_at?: string
          duration_hours?: number
          id?: string
          matures_at?: string
          reaped_at?: string | null
          reward_bps?: number
          started_at?: string
          status?: Database["public"]["Enums"]["cycle_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycles_booster_id_fkey"
            columns: ["booster_id"]
            isOneToOne: false
            referencedRelation: "boosters"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method: string
          proof_url: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method: string
          proof_url?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          proof_url?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      escrow_trades: {
        Row: {
          amount: number
          created_at: string
          dispute_reason: string | null
          id: string
          payee_id: string
          payer_id: string
          resolution: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["escrow_status"]
          terms: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          dispute_reason?: string | null
          id?: string
          payee_id: string
          payer_id: string
          resolution?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          terms?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          dispute_reason?: string | null
          id?: string
          payee_id?: string
          payer_id?: string
          resolution?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          terms?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          admin_note: string | null
          created_at: string
          document_path: string
          document_type: string
          full_name: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          document_path: string
          document_type: string
          full_name: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          document_path?: string
          document_type?: string
          full_name?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          memo: string | null
          ref_id: string | null
          ref_table: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          memo?: string | null
          ref_id?: string | null
          ref_table?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ledger_kind"]
          memo?: string | null
          ref_id?: string | null
          ref_table?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_fees: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["maintenance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["maintenance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_fees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          ref_id: string | null
          ref_table: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          ref_id?: string | null
          ref_table?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          ref_id?: string | null
          ref_table?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      p2p_transfers: {
        Row: {
          amount: number
          created_at: string
          fee: number
          id: string
          note: string | null
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["transfer_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          fee?: number
          id?: string
          note?: string | null
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["transfer_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          fee?: number
          id?: string
          note?: string | null
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["transfer_status"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          display_name: string | null
          frozen: boolean
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          frozen?: boolean
          id: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          frozen?: boolean
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          locked: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          locked?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          locked?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          amount_usdt: number | null
          created_at: string
          id: string
          locked_rate: number | null
          method: string
          proof_url: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          amount_usdt?: number | null
          created_at?: string
          id?: string
          locked_rate?: number | null
          method: string
          proof_url?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          amount_usdt?: number | null
          created_at?: string
          id?: string
          locked_rate?: number | null
          method?: string
          proof_url?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_balance: {
        Args: { p_amount: number; p_memo?: string; p_user: string }
        Returns: undefined
      }
      admin_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_detail?: Json
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      admin_cancel_cycle: { Args: { p_cycle_id: string }; Returns: undefined }
      admin_create_booster: {
        Args: {
          p_active: boolean
          p_code: string
          p_cost_seed: number
          p_duration_hours: number
          p_label: string
          p_reward_bps: number
        }
        Returns: string
      }
      admin_create_coupon: {
        Args: {
          p_amount: number
          p_code: string
          p_currency?: string
          p_expires?: string
          p_max: number
        }
        Returns: string
      }
      admin_create_coupons_bulk: {
        Args: {
          p_amount: number
          p_count: number
          p_currency?: string
          p_expires?: string
          p_max: number
          p_prefix?: string
        }
        Returns: string[]
      }
      admin_delete_booster: { Args: { p_id: string }; Returns: undefined }
      admin_force_mature_cycle: {
        Args: { p_cycle_id: string }
        Returns: undefined
      }
      admin_review_kyc: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      admin_review_request: {
        Args: {
          p_approve: boolean
          p_id: string
          p_note?: string
          p_type: string
        }
        Returns: undefined
      }
      admin_run_monthly_maintenance: { Args: never; Returns: number }
      admin_set_booster_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      admin_set_coupon_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      admin_set_frozen: {
        Args: { p_frozen: boolean; p_user: string }
        Returns: undefined
      }
      admin_set_maintenance: {
        Args: { p_global: boolean; p_message: string; p_pages: Json }
        Returns: undefined
      }
      admin_set_payout: {
        Args: { p_anchor: string; p_lock_enabled: boolean; p_timezone: string }
        Returns: undefined
      }
      admin_set_ticker: {
        Args: { p_enabled: boolean; p_items: Json }
        Returns: undefined
      }
      admin_update_booster: {
        Args: {
          p_active: boolean
          p_cost_seed: number
          p_duration_hours: number
          p_id: string
          p_label: string
          p_reward_bps: number
        }
        Returns: undefined
      }
      escrow_accept: { Args: { p_id: string }; Returns: undefined }
      escrow_cancel: { Args: { p_id: string }; Returns: undefined }
      escrow_create: {
        Args: {
          p_amount: number
          p_payee_id: string
          p_terms?: string
          p_title?: string
        }
        Returns: string
      }
      escrow_dispute: {
        Args: { p_id: string; p_reason?: string }
        Returns: undefined
      }
      escrow_release: { Args: { p_id: string }; Returns: undefined }
      escrow_resolve: {
        Args: { p_id: string; p_release: boolean; p_resolution?: string }
        Returns: undefined
      }
      find_profile_by_handle: {
        Args: { handle: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          referral_code: string
          username: string
        }[]
      }
      fmt_seed: { Args: { p_amount: number }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_uplines: {
        Args: { _user_id: string }
        Returns: {
          generation: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      kyc_submit: {
        Args: {
          p_document_path: string
          p_document_type: string
          p_full_name: string
          p_selfie_path: string
        }
        Returns: string
      }
      lookup_referrer: {
        Args: { _code: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
      notify_user: {
        Args: {
          p_body?: string
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_ref_id?: string
          p_ref_table?: string
          p_title: string
          p_user: string
        }
        Returns: undefined
      }
      p2p_send: {
        Args: { p_amount: number; p_note?: string; p_receiver_id: string }
        Returns: string
      }
      pay_cycle_commissions: {
        Args: { p_cycle_id: string }
        Returns: undefined
      }
      pay_maintenance_fee: { Args: { p_fee_id: string }; Returns: undefined }
      reap_cycle: { Args: { p_cycle_id: string }; Returns: undefined }
      redeem_coupon: { Args: { p_code: string }; Returns: string }
      start_cycle: {
        Args: { p_amount: number; p_booster_id: string }
        Returns: string
      }
      wallet_adjust: {
        Args: {
          p_amount: number
          p_kind: Database["public"]["Enums"]["ledger_kind"]
          p_memo?: string
          p_ref_id?: string
          p_ref_table?: string
          p_wallet: string
        }
        Returns: undefined
      }
      wallet_transfer: {
        Args: {
          p_amount: number
          p_from_wallet: string
          p_kind_in: Database["public"]["Enums"]["ledger_kind"]
          p_kind_out: Database["public"]["Enums"]["ledger_kind"]
          p_memo?: string
          p_ref_id?: string
          p_ref_table?: string
          p_to_wallet: string
        }
        Returns: undefined
      }
    }
    Enums: {
      aff_basis: "profit" | "profit_plus_capital"
      affiliate_source: "cycle" | "maintenance"
      app_role: "admin" | "moderator" | "user" | "farmer"
      cycle_status: "active" | "matured" | "reaped" | "cancelled"
      escrow_status:
        | "pending"
        | "accepted"
        | "released"
        | "cancelled"
        | "disputed"
        | "refunded"
      kyc_status: "unverified" | "pending" | "verified" | "rejected"
      ledger_kind:
        | "deposit"
        | "withdrawal"
        | "withdrawal_fee"
        | "transfer_in"
        | "transfer_out"
        | "p2p_in"
        | "p2p_out"
        | "p2p_fee"
        | "cycle_start"
        | "cycle_reap_principal"
        | "cycle_reap_reward"
        | "booster_apply"
        | "coupon_redeem"
        | "referral_bonus"
        | "escrow_lock"
        | "escrow_release"
        | "escrow_refund"
        | "admin_credit"
        | "admin_debit"
        | "fee"
        | "adjustment"
        | "test_credit"
        | "affiliate_commission"
        | "maintenance_fee"
      maintenance_status: "due" | "paid" | "waived" | "overdue"
      notification_kind:
        | "cycle_matured"
        | "cycle_reaped"
        | "deposit_approved"
        | "deposit_rejected"
        | "withdrawal_approved"
        | "withdrawal_rejected"
        | "transfer_received"
        | "escrow_created"
        | "escrow_accepted"
        | "escrow_released"
        | "escrow_cancelled"
        | "escrow_disputed"
        | "escrow_refunded"
        | "affiliate_commission"
        | "maintenance_due"
        | "admin_balance_adjusted"
        | "system"
      request_status: "pending" | "approved" | "rejected"
      transfer_status: "completed" | "failed"
      wallet_kind: "primary" | "farming"
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
      aff_basis: ["profit", "profit_plus_capital"],
      affiliate_source: ["cycle", "maintenance"],
      app_role: ["admin", "moderator", "user", "farmer"],
      cycle_status: ["active", "matured", "reaped", "cancelled"],
      escrow_status: [
        "pending",
        "accepted",
        "released",
        "cancelled",
        "disputed",
        "refunded",
      ],
      kyc_status: ["unverified", "pending", "verified", "rejected"],
      ledger_kind: [
        "deposit",
        "withdrawal",
        "withdrawal_fee",
        "transfer_in",
        "transfer_out",
        "p2p_in",
        "p2p_out",
        "p2p_fee",
        "cycle_start",
        "cycle_reap_principal",
        "cycle_reap_reward",
        "booster_apply",
        "coupon_redeem",
        "referral_bonus",
        "escrow_lock",
        "escrow_release",
        "escrow_refund",
        "admin_credit",
        "admin_debit",
        "fee",
        "adjustment",
        "test_credit",
        "affiliate_commission",
        "maintenance_fee",
      ],
      maintenance_status: ["due", "paid", "waived", "overdue"],
      notification_kind: [
        "cycle_matured",
        "cycle_reaped",
        "deposit_approved",
        "deposit_rejected",
        "withdrawal_approved",
        "withdrawal_rejected",
        "transfer_received",
        "escrow_created",
        "escrow_accepted",
        "escrow_released",
        "escrow_cancelled",
        "escrow_disputed",
        "escrow_refunded",
        "affiliate_commission",
        "maintenance_due",
        "admin_balance_adjusted",
        "system",
      ],
      request_status: ["pending", "approved", "rejected"],
      transfer_status: ["completed", "failed"],
      wallet_kind: ["primary", "farming"],
    },
  },
} as const
