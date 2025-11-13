import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AIPerformanceMetrics {
  totalRecommendations: number;
  totalOutcomes: number;
  averageAccuracy: number;
  excellentCount: number;
  fairCount: number;
  poorCount: number;
  profitableOutcomes: number;
  lossOutcomes: number;
  accuracyByRating: {
    excellent: number;
    fair: number;
    poor: number;
  };
  recentRecommendations: Array<{
    id: string;
    position_id: string;
    symbol: string;
    quality_rating: string;
    recommended_action: string;
    predicted_outcome: string;
    confidence_level: number;
    created_at: string;
    outcome?: {
      actual_outcome: string;
      actual_pnl: number;
      prediction_accuracy: number;
      closed_at: string;
    };
  }>;
}

export function useAIPerformance() {
  return useQuery({
    queryKey: ["ai-performance"],
    queryFn: async (): Promise<AIPerformanceMetrics> => {
      // Fetch all recommendations with their outcomes
      const { data: recommendations, error: recError } = await supabase
        .from("ai_recommendations")
        .select(`
          *,
          positions(symbol),
          ai_recommendation_outcomes(*)
        `)
        .order("created_at", { ascending: false });

      if (recError) throw recError;

      // Calculate metrics
      const totalRecommendations = recommendations?.length || 0;
      const withOutcomes = recommendations?.filter(r => r.ai_recommendation_outcomes?.length > 0) || [];
      const totalOutcomes = withOutcomes.length;

      const excellentCount = recommendations?.filter(r => r.quality_rating === "excellent").length || 0;
      const fairCount = recommendations?.filter(r => r.quality_rating === "fair").length || 0;
      const poorCount = recommendations?.filter(r => r.quality_rating === "poor").length || 0;

      const profitableOutcomes = withOutcomes.filter(r => 
        r.ai_recommendation_outcomes[0]?.actual_pnl > 0
      ).length;
      const lossOutcomes = withOutcomes.filter(r => 
        r.ai_recommendation_outcomes[0]?.actual_pnl <= 0
      ).length;

      // Calculate average accuracy
      const accuracySum = withOutcomes.reduce((sum, r) => 
        sum + (r.ai_recommendation_outcomes[0]?.prediction_accuracy || 0), 0
      );
      const averageAccuracy = totalOutcomes > 0 ? accuracySum / totalOutcomes : 0;

      // Calculate accuracy by rating
      const excellentWithOutcomes = withOutcomes.filter(r => r.quality_rating === "excellent");
      const fairWithOutcomes = withOutcomes.filter(r => r.quality_rating === "fair");
      const poorWithOutcomes = withOutcomes.filter(r => r.quality_rating === "poor");

      const accuracyByRating = {
        excellent: excellentWithOutcomes.length > 0 
          ? excellentWithOutcomes.reduce((sum, r) => sum + r.ai_recommendation_outcomes[0]?.prediction_accuracy, 0) / excellentWithOutcomes.length 
          : 0,
        fair: fairWithOutcomes.length > 0 
          ? fairWithOutcomes.reduce((sum, r) => sum + r.ai_recommendation_outcomes[0]?.prediction_accuracy, 0) / fairWithOutcomes.length 
          : 0,
        poor: poorWithOutcomes.length > 0 
          ? poorWithOutcomes.reduce((sum, r) => sum + r.ai_recommendation_outcomes[0]?.prediction_accuracy, 0) / poorWithOutcomes.length 
          : 0,
      };

      // Format recent recommendations
      const recentRecommendations = recommendations?.slice(0, 20).map(r => ({
        id: r.id,
        position_id: r.position_id,
        symbol: r.positions?.symbol || "N/A",
        quality_rating: r.quality_rating,
        recommended_action: r.recommended_action || "N/A",
        predicted_outcome: r.predicted_outcome || "N/A",
        confidence_level: r.confidence_level || 0,
        created_at: r.created_at,
        outcome: r.ai_recommendation_outcomes?.[0] ? {
          actual_outcome: r.ai_recommendation_outcomes[0].actual_outcome,
          actual_pnl: r.ai_recommendation_outcomes[0].actual_pnl,
          prediction_accuracy: r.ai_recommendation_outcomes[0].prediction_accuracy,
          closed_at: r.ai_recommendation_outcomes[0].closed_at,
        } : undefined,
      })) || [];

      return {
        totalRecommendations,
        totalOutcomes,
        averageAccuracy,
        excellentCount,
        fairCount,
        poorCount,
        profitableOutcomes,
        lossOutcomes,
        accuracyByRating,
        recentRecommendations,
      };
    },
  });
}