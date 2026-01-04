import { useLearningAssignedPositionsQueries } from "./learning/useLearningAssignedPositionsQueries";
import { useLearningAssignedPositionsMutations } from "./learning/useLearningAssignedPositionsMutations";

// Re-export types for backwards compatibility
export type { LearningCoveredCall, LearningAssignedPosition } from "./learning/types";

export const useLearningAssignedPositions = (userId?: string) => {
  const { assignedPositions, closedPositions, isLoading } = useLearningAssignedPositionsQueries(userId);
  const { assignPosition, sellCoveredCall, closeAssignedPosition } = useLearningAssignedPositionsMutations(userId);

  return {
    assignedPositions,
    closedPositions,
    isLoading,
    assignPosition,
    sellCoveredCall,
    closeAssignedPosition,
  };
};
