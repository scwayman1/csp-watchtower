import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { NewLearningPosition } from "./types";

export const useLearningPositionsMutations = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addPosition = useMutation({
    mutationFn: async (position: NewLearningPosition) => {
      const { data, error } = await supabase
        .from('learning_positions' as any)
        .insert([{ ...position, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-positions', userId] });
      toast({
        title: "Practice position added",
        description: "Position added to Learning Center simulator",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add position",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const closePosition = useMutation({
    mutationFn: async (positionId: string) => {
      const { error } = await supabase
        .from('learning_positions' as any)
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('id', positionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-positions', userId] });
      toast({
        title: "Position closed",
        description: "Practice position closed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to close position",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const deletePosition = useMutation({
    mutationFn: async (positionId: string) => {
      const { error } = await supabase
        .from('learning_positions' as any)
        .delete()
        .eq('id', positionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-positions', userId] });
      toast({
        title: "Position deleted",
        description: "Practice position removed from simulator",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete position",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    addPosition: addPosition.mutate,
    closePosition: closePosition.mutate,
    deletePosition: deletePosition.mutate,
  };
};
