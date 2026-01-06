import { useMemo } from "react";
import { useRealtimeSubscription, TableSubscription } from "@/hooks/useRealtimeSubscription";

export function usePositionsSubscriptions(refetch: () => Promise<void>) {
  const tables: TableSubscription[] = useMemo(
    () => [{ table: "positions" }, { table: "option_data" }],
    []
  );

  useRealtimeSubscription({
    channelName: "positions-changes",
    tables,
    onDataChange: refetch,
    refreshMarketData: true,
    refreshOptionPrices: true,
    fetchOnMount: true,
  });
}
