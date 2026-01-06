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
      advisor_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invite_token: string
          invited_by: string | null
          name: string
          status: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          name: string
          status?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          name?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_recommendation_outcomes: {
        Row: {
          actual_outcome: string
          actual_pnl: number | null
          closed_at: string
          created_at: string
          id: string
          position_id: string
          prediction_accuracy: number | null
          recommendation_id: string
          was_assigned: boolean | null
        }
        Insert: {
          actual_outcome: string
          actual_pnl?: number | null
          closed_at: string
          created_at?: string
          id?: string
          position_id: string
          prediction_accuracy?: number | null
          recommendation_id: string
          was_assigned?: boolean | null
        }
        Update: {
          actual_outcome?: string
          actual_pnl?: number | null
          closed_at?: string
          created_at?: string
          id?: string
          position_id?: string
          prediction_accuracy?: number | null
          recommendation_id?: string
          was_assigned?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendation_outcomes_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendation_outcomes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "ai_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          analysis_summary: string | null
          confidence_level: number | null
          created_at: string
          id: string
          metrics: Json | null
          position_id: string
          predicted_outcome: string | null
          quality_rating: string
          recommended_action: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_summary?: string | null
          confidence_level?: number | null
          created_at?: string
          id?: string
          metrics?: Json | null
          position_id: string
          predicted_outcome?: string | null
          quality_rating: string
          recommended_action?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_summary?: string | null
          confidence_level?: number | null
          created_at?: string
          id?: string
          metrics?: Json | null
          position_id?: string
          predicted_outcome?: string | null
          quality_rating?: string
          recommended_action?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations: {
        Row: {
          advisor_id: string
          client_id: string
          contracts: number
          created_at: string | null
          estimated_premium_total: number
          id: string
          model_trade_id: string
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          advisor_id: string
          client_id: string
          contracts: number
          created_at?: string | null
          estimated_premium_total: number
          id?: string
          model_trade_id: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string
          client_id?: string
          contracts?: number
          created_at?: string | null
          estimated_premium_total?: number
          id?: string
          model_trade_id?: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_model_trade_id_fkey"
            columns: ["model_trade_id"]
            isOneToOne: false
            referencedRelation: "model_trades"
            referencedColumns: ["id"]
          },
        ]
      }
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
      clients: {
        Row: {
          advisor_id: string
          available_cash: number | null
          created_at: string | null
          email: string | null
          id: string
          invite_status: string | null
          invite_token: string | null
          invited_at: string | null
          name: string
          notes: string | null
          open_csp_count: number | null
          phone_number: string | null
          portfolio_value: number | null
          premium_ytd: number | null
          risk_level: string | null
          segment: string | null
          sms_opt_in: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          advisor_id: string
          available_cash?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          invite_status?: string | null
          invite_token?: string | null
          invited_at?: string | null
          name: string
          notes?: string | null
          open_csp_count?: number | null
          phone_number?: string | null
          portfolio_value?: number | null
          premium_ytd?: number | null
          risk_level?: string | null
          segment?: string | null
          sms_opt_in?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          advisor_id?: string
          available_cash?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          invite_status?: string | null
          invite_token?: string | null
          invited_at?: string | null
          name?: string
          notes?: string | null
          open_csp_count?: number | null
          phone_number?: string | null
          portfolio_value?: number | null
          premium_ytd?: number | null
          risk_level?: string | null
          segment?: string | null
          sms_opt_in?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      cycles: {
        Row: {
          advisor_id: string
          created_at: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          advisor_id: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      household_members: {
        Row: {
          created_at: string | null
          id: string
          member_user_id: string
          primary_user_id: string
          relationship: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_user_id: string
          primary_user_id: string
          relationship?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_user_id?: string
          primary_user_id?: string
          relationship?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      learning_assigned_positions: {
        Row: {
          assignment_date: string
          assignment_price: number
          closed_at: string | null
          cost_basis: number
          created_at: string
          id: string
          is_active: boolean
          original_learning_position_id: string | null
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
          original_learning_position_id?: string | null
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
          original_learning_position_id?: string | null
          original_put_premium?: number
          shares?: number
          sold_price?: number | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_covered_calls: {
        Row: {
          closed_at: string | null
          contracts: number
          created_at: string
          expiration: string
          id: string
          is_active: boolean
          learning_assigned_position_id: string
          opened_at: string
          premium_per_contract: number
          strike_price: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          contracts?: number
          created_at?: string
          expiration: string
          id?: string
          is_active?: boolean
          learning_assigned_position_id: string
          opened_at?: string
          premium_per_contract: number
          strike_price: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          contracts?: number
          created_at?: string
          expiration?: string
          id?: string
          is_active?: boolean
          learning_assigned_position_id?: string
          opened_at?: string
          premium_per_contract?: number
          strike_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_covered_calls_learning_assigned_position_id_fkey"
            columns: ["learning_assigned_position_id"]
            isOneToOne: false
            referencedRelation: "learning_assigned_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_positions: {
        Row: {
          closed_at: string | null
          contracts: number
          created_at: string
          expiration: string
          id: string
          is_active: boolean
          notes: string | null
          opened_at: string
          premium_per_contract: number
          strike_price: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          contracts?: number
          created_at?: string
          expiration: string
          id?: string
          is_active?: boolean
          notes?: string | null
          opened_at?: string
          premium_per_contract: number
          strike_price: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          contracts?: number
          created_at?: string
          expiration?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          opened_at?: string
          premium_per_contract?: number
          strike_price?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      message_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          channel: string
          content: string
          created_at: string
          direction: string
          id: string
          meta: Json | null
          provider_message_id: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          channel?: string
          content: string
          created_at?: string
          direction?: string
          id?: string
          meta?: Json | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          channel?: string
          content?: string
          created_at?: string
          direction?: string
          id?: string
          meta?: Json | null
          provider_message_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      model_trades: {
        Row: {
          advisor_id: string
          created_at: string | null
          cycle_id: string
          expiration: string
          id: string
          notes: string | null
          risk_level: string | null
          source: string | null
          strategy: string
          strike: number
          target_premium: number
          underlying: string
          updated_at: string | null
        }
        Insert: {
          advisor_id: string
          created_at?: string | null
          cycle_id: string
          expiration: string
          id?: string
          notes?: string | null
          risk_level?: string | null
          source?: string | null
          strategy: string
          strike: number
          target_premium: number
          underlying: string
          updated_at?: string | null
        }
        Update: {
          advisor_id?: string
          created_at?: string | null
          cycle_id?: string
          expiration?: string
          id?: string
          notes?: string | null
          risk_level?: string | null
          source?: string | null
          strategy?: string
          strike?: number
          target_premium?: number
          underlying?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_trades_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
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
            isOneToOne: true
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_history: {
        Row: {
          assigned_shares_value: number
          cash_balance: number
          created_at: string
          event_description: string | null
          event_type: string
          id: string
          net_position_pnl: number
          portfolio_value: number
          positions_value: number
          total_premiums_collected: number
          user_id: string
        }
        Insert: {
          assigned_shares_value: number
          cash_balance: number
          created_at?: string
          event_description?: string | null
          event_type: string
          id?: string
          net_position_pnl?: number
          portfolio_value: number
          positions_value: number
          total_premiums_collected?: number
          user_id: string
        }
        Update: {
          assigned_shares_value?: number
          cash_balance?: number
          created_at?: string
          event_description?: string | null
          event_type?: string
          id?: string
          net_position_pnl?: number
          portfolio_value?: number
          positions_value?: number
          total_premiums_collected?: number
          user_id?: string
        }
        Relationships: []
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
          allocation_id: string | null
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
          source: string | null
          strike_price: number
          symbol: string
          underlying_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allocation_id?: string | null
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
          source?: string | null
          strike_price: number
          symbol: string
          underlying_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allocation_id?: string | null
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
          source?: string | null
          strike_price?: number
          symbol?: string
          underlying_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          investment_experience: string | null
          investment_goals: string | null
          onboarding_completed_at: string | null
          preferred_strategies: string[] | null
          risk_tolerance: string | null
          updated_at: string
          user_id: string
          years_trading: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          investment_experience?: string | null
          investment_goals?: string | null
          onboarding_completed_at?: string | null
          preferred_strategies?: string[] | null
          risk_tolerance?: string | null
          updated_at?: string
          user_id: string
          years_trading?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          investment_experience?: string | null
          investment_goals?: string | null
          onboarding_completed_at?: string | null
          preferred_strategies?: string[] | null
          risk_tolerance?: string | null
          updated_at?: string
          user_id?: string
          years_trading?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      simulator_portfolio_history: {
        Row: {
          assigned_shares_value: number
          cash_balance: number
          created_at: string
          event_description: string | null
          event_type: string
          id: string
          portfolio_value: number
          positions_value: number
          total_premiums_collected: number
          user_id: string
        }
        Insert: {
          assigned_shares_value: number
          cash_balance: number
          created_at?: string
          event_description?: string | null
          event_type: string
          id?: string
          portfolio_value: number
          positions_value: number
          total_premiums_collected?: number
          user_id: string
        }
        Update: {
          assigned_shares_value?: number
          cash_balance?: number
          created_at?: string
          event_description?: string | null
          event_type?: string
          id?: string
          portfolio_value?: number
          positions_value?: number
          total_premiums_collected?: number
          user_id?: string
        }
        Relationships: []
      }
      simulator_settings: {
        Row: {
          created_at: string
          id: string
          starting_capital: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          starting_capital?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          starting_capital?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          advisor_id: string
          client_id: string
          created_at: string
          id: string
          last_message_at: string
          primary_client_id: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          advisor_id: string
          client_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          primary_client_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          advisor_id?: string
          client_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          primary_client_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_primary_client_id_fkey"
            columns: ["primary_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          cash_balance: number | null
          created_at: string | null
          id: string
          market_data_provider: string | null
          other_holdings_value: number | null
          probability_model: string | null
          refresh_rate_seconds: number | null
          safe_threshold: number | null
          updated_at: string | null
          user_id: string
          volatility_sensitivity: number | null
          warning_threshold: number | null
        }
        Insert: {
          cash_balance?: number | null
          created_at?: string | null
          id?: string
          market_data_provider?: string | null
          other_holdings_value?: number | null
          probability_model?: string | null
          refresh_rate_seconds?: number | null
          safe_threshold?: number | null
          updated_at?: string | null
          user_id: string
          volatility_sensitivity?: number | null
          warning_threshold?: number | null
        }
        Update: {
          cash_balance?: number | null
          created_at?: string | null
          id?: string
          market_data_provider?: string | null
          other_holdings_value?: number | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_household_member: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "investor" | "advisor" | "admin"
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
      app_role: ["investor", "advisor", "admin"],
    },
  },
} as const
