import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LearningAssignedPosition } from "./types";

export const useLearningAssignedPositionsQueries = (userId?: string) => {
  const { data: assignedPositions = [], isLoading } = useQuery({
    queryKey: ['learning-assigned-positions', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('learning_assigned_positions' as any)
        .select(`
          *,
          covered_calls:learning_covered_calls(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as LearningAssignedPosition[];
    },
    enabled: !!userId,
  });

  const { data: closedPositions = [] } = useQuery({
    queryKey: ['learning-assigned-positions-closed', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('learning_assigned_positions' as any)
        .select(`
          *,
          covered_calls:learning_covered_calls(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', false)
        .not('sold_price', 'is', null)
        .order('closed_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as LearningAssignedPosition[];
    },
    enabled: !!userId,
  });

  return {
    assignedPositions,
    closedPositions,
    isLoading,
  };
};
