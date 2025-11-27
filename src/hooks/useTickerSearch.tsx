import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TickerSearchResult {
  symbol: string;
  description: string;
  displaySymbol: string;
}

export const useTickerSearch = (query: string) => {
  return useQuery({
    queryKey: ['ticker-search', query],
    queryFn: async () => {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const { data, error } = await supabase.functions.invoke('search-ticker', {
        body: { query: query.trim() }
      });

      if (error) throw error;
      return (data?.results || []) as TickerSearchResult[];
    },
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
