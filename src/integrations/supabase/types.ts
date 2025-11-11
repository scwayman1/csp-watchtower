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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assigned_positions: {
        Row: {
          assignment_date: string
          assignment_price: number
          closed_at: string | null
          cost_basis: number
          created_at: string
          id: string
          is_active: boolean
          original_position_id: string | null
          original_put_premium: number
          shares: number
          sold_price: number | null
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_date: string
          assignment_price: number
          closed_at?: string | null
          cost_basis: number
          created_at?: string
          id?: string
          is_active?: boolean
          original_position_id?: string | null
          original_put_premium?: number
          shares: number
          sold_price?: number | null
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_date?: string
          assignment_price?: number
          closed_at?: string | null
          cost_basis?: number
          created_at?: string
          id?: string
          is_active?: boolean
          original_position_id?: string | null
          original_put_premium?: number
          shares?: number
          sold_price?: number | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_positions_original_position_id_fkey"
            columns: ["original_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      covered_calls: {
        Row: {
          assigned_position_id: string
          closed_at: string | null
          contracts: number
          created_at: string
          expiration: string
          id: string
          is_active: boolean
          opened_at: string
          premium_per_contract: number
          strike_price: number
          updated_at: string
        }
        Insert: {
          assigned_position_id: string
          closed_at?: string | null
          contracts?: number
          created_at?: string
          expiration: string
          id?: string
          is_active?: boolean
          opened_at?: string
          premium_per_contract: number
          strike_price: number
          updated_at?: string
        }
        Update: {
          assigned_position_id?: string
          closed_at?: string | null
          contracts?: number
          created_at?: string
          expiration?: string
          id?: string
          is_active?: boolean
          opened_at?: string
          premium_per_contract?: number
          strike_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "covered_calls_assigned_position_id_fkey"
            columns: ["assigned_position_id"]
            isOneToOne: false
            referencedRelation: "assigned_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data: {
        Row: {
          day_change_pct: number | null
          day_open: number | null
          id: string
          intraday_prices: Json | null
          last_updated: string | null
          symbol: string
          underlying_price: number | null
        }
        Insert: {
          day_change_pct?: number | null
          day_open?: number | null
          id?: string
          intraday_prices?: Json | null
          last_updated?: string | null
          symbol: string
          underlying_price?: number | null
        }
        Update: {
          day_change_pct?: number | null
          day_open?: number | null
          id?: string
          intraday_prices?: Json | null
          last_updated?: string | null
          symbol?: string
          underlying_price?: number | null
        }
        Relationships: []
      }
      option_data: {
        Row: {
          ask_price: number | null
          bid_price: number | null
          delta: number | null
          id: string
          implied_volatility: number | null
          last_updated: string | null
          mark_price: number | null
          position_id: string
        }
        Insert: {
          ask_price?: number | null
          bid_price?: number | null
          delta?: number | null
          id?: string
          implied_volatility?: number | null
          last_updated?: string | null
          mark_price?: number | null
          position_id: string
        }
        Update: {
          ask_price?: number | null
          bid_price?: number | null
          delta?: number | null
          id?: string
          implied_volatility?: number | null
          last_updated?: string | null
          mark_price?: number | null
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_data_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      position_shares: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invite_token: string
          owner_id: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invite_token?: string
          owner_id: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invite_token?: string
          owner_id?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          broker: string | null
          closed_at: string | null
          contracts: number
          created_at: string | null
          expiration: string
          id: string
          is_active: boolean | null
          open_fees: number | null
          opened_at: string | null
          premium_per_contract: number
          raw_order_text: string | null
          strike_price: number
          symbol: string
          underlying_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          broker?: string | null
          closed_at?: string | null
          contracts?: number
          created_at?: string | null
          expiration: string
          id?: string
          is_active?: boolean | null
          open_fees?: number | null
          opened_at?: string | null
          premium_per_contract: number
          raw_order_text?: string | null
          strike_price: number
          symbol: string
          underlying_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          broker?: string | null
          closed_at?: string | null
          contracts?: number
          created_at?: string | null
          expiration?: string
          id?: string
          is_active?: boolean | null
          open_fees?: number | null
          opened_at?: string | null
          premium_per_contract?: number
          raw_order_text?: string | null
          strike_price?: number
          symbol?: string
          underlying_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          api_key: string | null
          created_at: string | null
          id: string
          market_data_provider: string | null
          probability_model: string | null
          refresh_rate_seconds: number | null
          safe_threshold: number | null
          updated_at: string | null
          user_id: string
          volatility_sensitivity: number | null
          warning_threshold: number | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string | null
          id?: string
          market_data_provider?: string | null
          probability_model?: string | null
          refresh_rate_seconds?: number | null
          safe_threshold?: number | null
          updated_at?: string | null
          user_id: string
          volatility_sensitivity?: number | null
          warning_threshold?: number | null
        }
        Update: {
          api_key?: string | null
          created_at?: string | null
          id?: string
          market_data_provider?: string | null
          probability_model?: string | null
          refresh_rate_seconds?: number | null
          safe_threshold?: number | null
          updated_at?: string | null
          user_id?: string
          volatility_sensitivity?: number | null
          warning_threshold?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_share_by_invite_token: {
        Args: { token_input: string }
        Returns: {
          accepted_at: string
          created_at: string
          id: string
          invite_token: string
          owner_id: string
          shared_with_email: string
          shared_with_user_id: string
        }[]
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
