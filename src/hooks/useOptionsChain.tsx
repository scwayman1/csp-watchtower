import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OptionData {
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta?: number;
  inTheMoney: boolean;
  lastPrice: number;
}

interface OptionChainData {
  underlyingPrice: number;
  expirations: string[];
  optionsByExpiration: Record<string, OptionData[]>;
  timestamp: number;
}

export const useOptionsChain = (symbol: string | null) => {
  const { toast } = useToast();
  const [isStale, setIsStale] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['options-chain', symbol],
    queryFn: async () => {
      if (!symbol) return null;

      const { data, error } = await supabase.functions.invoke('fetch-option-chain', {
        body: { symbol: symbol.toUpperCase() }
      });

      if (error) throw error;

      // Check staleness
      const timestamp = data?.timestamp || Date.now();
      const age = (Date.now() - timestamp) / 1000;
      setIsStale(age > 15);

      return data as OptionChainData;
    },
    enabled: !!symbol,
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const checkDataQuality = (chainData: OptionChainData | null) => {
    if (!chainData) return { isValid: true, reason: null };

    // Check if any options have unrealistic spreads
    const hasWideSpreads = Object.values(chainData.optionsByExpiration).some(options =>
      options.some(opt => {
        const spread = opt.ask - opt.bid;
        const midPrice = (opt.bid + opt.ask) / 2;
        return midPrice > 0 && (spread / midPrice) > 0.08; // 8% spread threshold
      })
    );

    if (hasWideSpreads) {
      return { 
        isValid: false, 
        reason: "Wide spreads detected - quotes may be stale" 
      };
    }

    return { isValid: true, reason: null };
  };

  const quality = checkDataQuality(data);

  return {
    data,
    isLoading,
    error,
    refetch,
    isStale: isStale || !quality.isValid,
    staleReason: quality.reason,
  };
};
