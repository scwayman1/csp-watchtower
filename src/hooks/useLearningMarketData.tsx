import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLearningMarketData = (symbols: string[]) => {
  return useQuery({
    queryKey: ['learning-market-data', symbols.sort().join(',')],
    queryFn: async () => {
      if (symbols.length === 0) return {};
      
      const { data, error } = await supabase
        .from('market_data' as any)
        .select('symbol, underlying_price, day_change_pct')
        .in('symbol', symbols);

      if (error) throw error;
      
      // Convert array to map for easy lookup
      const dataMap: Record<string, { price: number; change_pct: number }> = {};
      (data || []).forEach((item: any) => {
        dataMap[item.symbol] = {
          price: item.underlying_price || 0,
          change_pct: item.day_change_pct || 0
        };
      });
      
      return dataMap;
    },
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};