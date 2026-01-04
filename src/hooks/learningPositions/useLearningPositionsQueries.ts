import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LearningPosition } from "./types";

export const useLearningPositionsQueries = (userId?: string) => {
  const { data: positions = [], isLoading, refetch } = useQuery({
    queryKey: ['learning-positions', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('learning_positions' as any)
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as LearningPosition[];
    },
    enabled: !!userId,
  });

  return {
    positions,
    isLoading,
    refetch,
  };
};
