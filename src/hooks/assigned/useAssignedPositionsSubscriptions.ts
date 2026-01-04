import { useMemo } from "react";
import { useRealtimeSubscription, TableSubscription } from "@/hooks/useRealtimeSubscription";

export function useAssignedPositionsSubscriptions(refetch: () => Promise<void>) {
  const tables: TableSubscription[] = useMemo(
    () => [
      { table: "assigned_positions" },
      { table: "covered_calls" },
      { table: "market_data", event: "UPDATE" },
    ],
    []
  );

  useRealtimeSubscription({
    channelName: "assigned-positions",
    tables,
    onDataChange: refetch,
    refreshMarketData: true,
    fetchOnMount: false,
  });
}
