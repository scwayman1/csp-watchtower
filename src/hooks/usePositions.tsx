import { usePositionsQueries } from "./positions/usePositionsQueries";
import { usePositionsSubscriptions } from "./positions/usePositionsSubscriptions";

// Re-export types for backwards compatibility
export type { Position } from "./positions/types";

export function usePositions(userId?: string) {
  const { positions, loading, sharedOwners, refetch } = usePositionsQueries(userId);
  
  // Set up realtime subscriptions and market data refresh
  usePositionsSubscriptions(refetch);

  return { positions, loading, refetch, sharedOwners };
}
