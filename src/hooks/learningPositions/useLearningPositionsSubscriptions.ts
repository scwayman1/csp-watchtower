import { useMemo } from "react";
import { useRealtimeSubscription, TableSubscription } from "@/hooks/useRealtimeSubscription";

export function useLearningPositionsSubscriptions(refetch: () => Promise<void>) {
  const tables: TableSubscription[] = useMemo(
    () => [
      { table: "learning_positions" },
      { table: "market_data", event: "UPDATE" },
    ],
    []
  );

  useRealtimeSubscription({
    channelName: "learning-positions",
    tables,
    onDataChange: refetch,
    refreshMarketData: true,
    fetchOnMount: false,
  });
}
