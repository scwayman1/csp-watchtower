import { useMemo } from "react";
import { useRealtimeSubscription, TableSubscription } from "@/hooks/useRealtimeSubscription";

export function useLearningAssignedPositionsSubscriptions(refetch: () => Promise<void>) {
  const tables: TableSubscription[] = useMemo(
    () => [
      { table: "learning_assigned_positions" },
      { table: "learning_covered_calls" },
      { table: "market_data", event: "UPDATE" },
    ],
    []
  );

  useRealtimeSubscription({
    channelName: "learning-assigned-positions",
    tables,
    onDataChange: refetch,
    refreshMarketData: true,
    fetchOnMount: false,
  });
}
