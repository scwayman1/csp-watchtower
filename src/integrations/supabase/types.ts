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
      market_data: {
        Row: {
          id: string
          last_updated: string | null
          symbol: string
          underlying_price: number | null
        }
        Insert: {
          id?: string
          last_updated?: string | null
          symbol: string
          underlying_price?: number | null
        }
        Update: {
          id?: string
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
          created_at: string | null
          id: string
          owner_id: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_id: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
