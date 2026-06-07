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
      app_settings: {
        Row: {
          cycle_base_reward_pct: number
          cycle_duration_days: number
          id: boolean
          max_cycle_seed: number
          min_cycle_seed: number
          min_deposit_seed: number
          min_withdraw_seed: number
          p2p_fee_pct: number
          referral_bonus_pct: number
          seed_to_usdt: number
          updated_at: string
          withdraw_fee_pct: number
        }
        Insert: {
          cycle_base_reward_pct?: number
          cycle_duration_days?: number
          id?: boolean
          max_cycle_seed?: number
          min_cycle_seed?: number
          min_deposit_seed?: number
          min_withdraw_seed?: number
          p2p_fee_pct?: number
          referral_bonus_pct?: number
          seed_to_usdt?: number
          updated_at?: string
          withdraw_fee_pct?: number
        }
        Update: {
          cycle_base_reward_pct?: number
          cycle_duration_days?: number
          id?: boolean
          max_cycle_seed?: number
          min_cycle_seed?: number
          min_deposit_seed?: number
          min_withdraw_seed?: number
          p2p_fee_pct?: number
          referral_bonus_pct?: number
          seed_to_usdt?: number
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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          display_name: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      reap_cycle: { Args: { p_cycle_id: string }; Returns: undefined }
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
      app_role: "admin" | "moderator" | "user"
      cycle_status: "active" | "matured" | "reaped" | "cancelled"
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
      request_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "moderator", "user"],
      cycle_status: ["active", "matured", "reaped", "cancelled"],
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
      ],
      request_status: ["pending", "approved", "rejected"],
      wallet_kind: ["primary", "farming"],
    },
  },
} as const
