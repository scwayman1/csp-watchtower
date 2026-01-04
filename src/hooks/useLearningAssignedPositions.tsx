import { useLearningAssignedPositionsQueries } from "./learning/useLearningAssignedPositionsQueries";
import { useLearningAssignedPositionsMutations } from "./learning/useLearningAssignedPositionsMutations";
import { useLearningAssignedPositionsSubscriptions } from "./learning/useLearningAssignedPositionsSubscriptions";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// Re-export types for backwards compatibility
export type { LearningCoveredCall, LearningAssignedPosition } from "./learning/types";

export const useLearningAssignedPositions = (userId?: string) => {
  const queryClient = useQueryClient();
  const { assignedPositions, closedPositions, isLoading } = useLearningAssignedPositionsQueries(userId);
  const { assignPosition, sellCoveredCall, closeAssignedPosition } = useLearningAssignedPositionsMutations(userId);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['learning-assigned-positions', userId] });
    await queryClient.invalidateQueries({ queryKey: ['learning-assigned-positions-closed', userId] });
  }, [queryClient, userId]);

  // Set up realtime subscriptions
  useLearningAssignedPositionsSubscriptions(refetch);

  return {
    assignedPositions,
    closedPositions,
    isLoading,
    assignPosition,
    sellCoveredCall,
    closeAssignedPosition,
  };
};
