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
  options: Record<string, OptionData[]>;
  timestamp: number;
}

export const useOptionsChain = (symbol: string | null, optionType: 'PUT' | 'CALL' = 'PUT') => {
  const { toast } = useToast();
  const [isStale, setIsStale] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['options-chain', symbol, optionType],
    queryFn: async () => {
      if (!symbol) return null;

      const { data, error } = await supabase.functions.invoke('fetch-option-chain', {
        body: { symbol: symbol.toUpperCase(), optionType }
      });

      if (error) {
        // Check if it's an invalid ticker error
        const errorMessage = error.message || JSON.stringify(error);
        if (errorMessage.includes('No quote data found')) {
          toast({
            title: "Invalid Ticker Symbol",
            description: `"${symbol}" is not a valid ticker symbol. Please check the symbol and try again.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error Loading Options",
            description: errorMessage,
            variant: "destructive",
          });
        }
        throw error;
      }

      // Check staleness
      const timestamp = data?.timestamp || Date.now();
      const age = (Date.now() - timestamp) / 1000;
      setIsStale(age > 30);

      return data as OptionChainData;
    },
    enabled: !!symbol,
    staleTime: 300000, // Consider data stale after 5 minutes (matches cache)
    gcTime: 600000, // Keep in cache for 10 minutes
    refetchInterval: false, // Disable auto-refresh - user must manually refresh
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    retry: 2,
  });

  const checkDataQuality = (chainData: OptionChainData | null) => {
    if (!chainData || !chainData.options) return { isValid: true, reason: null };

    // Check if any options have unrealistic spreads
    const hasWideSpreads = Object.values(chainData.options).some(options =>
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
