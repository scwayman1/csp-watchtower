import { useMemo } from "react";
import { useRealtimeSubscription, TableSubscription } from "@/hooks/useRealtimeSubscription";

export function usePositionsSubscriptions(refetch: () => Promise<void>) {
  const tables: TableSubscription[] = useMemo(
    () => [{ table: "positions" }],
    []
  );

  useRealtimeSubscription({
    channelName: "positions-changes",
    tables,
    onDataChange: refetch,
    refreshMarketData: true,
    fetchOnMount: true,
  });
}
