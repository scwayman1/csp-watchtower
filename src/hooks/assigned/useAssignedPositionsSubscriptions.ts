import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAssignedPositionsSubscriptions(refetch: () => Promise<void>) {
  useEffect(() => {
    // Subscribe to realtime changes
    const assignedChannel = supabase
      .channel('assigned-positions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assigned_positions',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    const callsChannel = supabase
      .channel('covered-calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'covered_calls',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    // Subscribe to market data changes for real-time price updates
    const marketDataChannel = supabase
      .channel('market-data-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'market_data',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    // Set up market data refresh interval (same as active positions)
    const refreshMarketData = async () => {
      try {
        await supabase.functions.invoke('refresh-market-data');
        await refetch();
      } catch (error) {
        console.error('Error refreshing market data for assigned positions:', error);
      }
    };

    // Initial refresh
    refreshMarketData();

    // Refresh every 60 seconds
    const intervalId = setInterval(refreshMarketData, 60000);

    return () => {
      supabase.removeChannel(assignedChannel);
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(marketDataChannel);
      clearInterval(intervalId);
    };
  }, [refetch]);
}
