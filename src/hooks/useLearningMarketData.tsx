import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";

export const useLearningMarketData = (symbols: string[]) => {
  const refreshedRef = useRef<Set<string>>(new Set());

  const query = useQuery({
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
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
  });

  // Trigger refresh for missing symbols
  useEffect(() => {
    const refreshMissingSymbols = async () => {
      if (symbols.length === 0) return;
      
      // Find symbols that don't have data yet
      const missingSymbols = symbols.filter(
        s => !refreshedRef.current.has(s) && (!query.data || !query.data[s] || query.data[s].price === 0)
      );
      
      if (missingSymbols.length === 0) return;
      
      // Mark as refreshed to avoid repeated calls
      missingSymbols.forEach(s => refreshedRef.current.add(s));
      
      console.log('Refreshing market data for simulator symbols:', missingSymbols);
      
      try {
        await supabase.functions.invoke('refresh-market-data', {
          body: { symbols: missingSymbols }
        });
        
        // Refetch the query after refresh
        setTimeout(() => query.refetch(), 1000);
      } catch (error) {
        console.error('Failed to refresh market data:', error);
        // Remove from refreshed set so it can retry
        missingSymbols.forEach(s => refreshedRef.current.delete(s));
      }
    };

    refreshMissingSymbols();
  }, [symbols, query.data]);

  return query;
};
