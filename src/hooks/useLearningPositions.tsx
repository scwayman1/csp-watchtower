import { useLearningPositionsQueries } from "./learningPositions/useLearningPositionsQueries";
import { useLearningPositionsMutations } from "./learningPositions/useLearningPositionsMutations";

// Re-export types for backwards compatibility
export type { LearningPosition, NewLearningPosition } from "./learningPositions/types";

export const useLearningPositions = (userId?: string) => {
  const { positions, isLoading, refetch } = useLearningPositionsQueries(userId);
  const { addPosition, closePosition, deletePosition } = useLearningPositionsMutations(userId);

  return {
    positions,
    isLoading,
    refetch,
    addPosition,
    closePosition,
    deletePosition,
  };
};
