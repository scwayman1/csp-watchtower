import { useCallback } from "react";
import { useLearningPositionsQueries } from "./learningPositions/useLearningPositionsQueries";
import { useLearningPositionsMutations } from "./learningPositions/useLearningPositionsMutations";
import { useLearningPositionsSubscriptions } from "./learningPositions/useLearningPositionsSubscriptions";

// Re-export types for backwards compatibility
export type { LearningPosition, NewLearningPosition } from "./learningPositions/types";

export const useLearningPositions = (userId?: string) => {
  const { positions, isLoading, refetch } = useLearningPositionsQueries(userId);
  const { addPosition, closePosition, deletePosition } = useLearningPositionsMutations(userId);

  const handleRefetch = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Set up realtime subscriptions
  useLearningPositionsSubscriptions(handleRefetch);

  return {
    positions,
    isLoading,
    refetch,
    addPosition,
    closePosition,
    deletePosition,
  };
};
