import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserSettings {
  probability_model: string;
  safe_threshold: number;
  warning_threshold: number;
  market_data_provider: string;
  refresh_rate_seconds: number;
  volatility_sensitivity: number;
  cash_balance: number;
  other_holdings_value: number;
}

export function useSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<UserSettings>({
    probability_model: 'delta',
    safe_threshold: 10,
    warning_threshold: 5,
    market_data_provider: 'yahoo',
    refresh_rate_seconds: 60,
    volatility_sensitivity: 0.15,
    cash_balance: 0,
    other_holdings_value: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (data) {
          setSettings({
            probability_model: data.probability_model || 'delta',
            safe_threshold: data.safe_threshold || 10,
            warning_threshold: data.warning_threshold || 5,
            market_data_provider: data.market_data_provider || 'yahoo',
            refresh_rate_seconds: data.refresh_rate_seconds || 60,
            volatility_sensitivity: data.volatility_sensitivity || 0.15,
            cash_balance: data.cash_balance || 0,
            other_holdings_value: data.other_holdings_value || 0,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [userId]);

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      setSettings(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  return { settings, loading, updateSettings };
}
