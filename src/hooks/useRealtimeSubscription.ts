import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TableSubscription {
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
}

export interface RealtimeSubscriptionOptions {
  /** Unique channel name prefix */
  channelName: string;
  /** Tables to subscribe to */
  tables: TableSubscription[];
  /** Callback when any subscribed table changes */
  onDataChange: () => void;
  /** Whether to refresh market data periodically */
  refreshMarketData?: boolean;
  /** Whether to refresh option prices periodically */
  refreshOptionPrices?: boolean;
  /** Market data refresh interval in ms (default: 60000) */
  refreshInterval?: number;
  /** Whether to call onDataChange immediately on mount */
  fetchOnMount?: boolean;
}

export function useRealtimeSubscription({
  channelName,
  tables,
  onDataChange,
  refreshMarketData = false,
  refreshOptionPrices = false,
  refreshInterval = 60000,
  fetchOnMount = true,
}: RealtimeSubscriptionOptions) {
  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  useEffect(() => {
    if (fetchOnMount) {
      onDataChangeRef.current();
    }

    // Create channels for each table subscription
    const channels = tables.map((sub, index) => {
      const channel = supabase
        .channel(`${channelName}-${sub.table}-${index}`)
        .on(
          "postgres_changes" as const,
          {
            event: sub.event || "*",
            schema: sub.schema || "public",
            table: sub.table,
          } as any,
          () => {
            onDataChangeRef.current();
          }
        )
        .subscribe();

      return channel;
    });

    let marketDataIntervalId: ReturnType<typeof setInterval> | undefined;
    let optionPricesIntervalId: ReturnType<typeof setInterval> | undefined;

    if (refreshMarketData) {
      const doRefresh = async () => {
        try {
          await supabase.functions.invoke("refresh-market-data");
          onDataChangeRef.current();
        } catch (error) {
          console.error("Error refreshing market data:", error);
        }
      };

      // Initial refresh
      doRefresh();

      // Periodic refresh
      marketDataIntervalId = setInterval(doRefresh, refreshInterval);
    }

    if (refreshOptionPrices) {
      const doRefreshOptions = async () => {
        try {
          await supabase.functions.invoke("refresh-option-prices");
          onDataChangeRef.current();
        } catch (error) {
          console.error("Error refreshing option prices:", error);
        }
      };

      // Initial refresh (with slight delay to avoid overwhelming the API)
      setTimeout(doRefreshOptions, 2000);

      // Periodic refresh (every 2 minutes for option prices to avoid rate limiting)
      optionPricesIntervalId = setInterval(doRefreshOptions, 120000);
    }

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
      if (marketDataIntervalId) {
        clearInterval(marketDataIntervalId);
      }
      if (optionPricesIntervalId) {
        clearInterval(optionPricesIntervalId);
      }
    };
  }, [channelName, refreshMarketData, refreshOptionPrices, refreshInterval, fetchOnMount, tables.length]);
}
