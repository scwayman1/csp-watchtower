import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePositionsSubscriptions(refetch: () => Promise<void>) {
  useEffect(() => {
    refetch();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('positions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    // Set up market data refresh interval
    const refreshMarketData = async () => {
      try {
        await supabase.functions.invoke('refresh-market-data');
      } catch (error) {
        console.error('Error refreshing market data:', error);
      }
    };

    // Initial fetch
    refreshMarketData();

    // Refresh every 60 seconds
    const intervalId = setInterval(refreshMarketData, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [refetch]);
}
