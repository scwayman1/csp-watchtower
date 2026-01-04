import { useAssignedPositionsQueries } from "./assigned/useAssignedPositionsQueries";
import { useAssignedPositionsSubscriptions } from "./assigned/useAssignedPositionsSubscriptions";

// Re-export types for backwards compatibility
export type { CoveredCall, AssignedPosition } from "./assigned/types";

export function useAssignedPositions(userId?: string, includeInactive = false) {
  const { assignedPositions, closedPositions, loading, refetch } = useAssignedPositionsQueries(userId);
  
  // Set up realtime subscriptions and market data refresh
  useAssignedPositionsSubscriptions(refetch);

  return { assignedPositions, closedPositions, loading, refetch };
}
