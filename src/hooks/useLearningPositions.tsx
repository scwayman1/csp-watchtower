import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LearningPosition {
  id: string;
  user_id: string;
  symbol: string;
  strike_price: number;
  expiration: string;
  contracts: number;
  premium_per_contract: number;
  opened_at: string;
  closed_at?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface NewLearningPosition {
  symbol: string;
  strike_price: number;
  expiration: string;
  contracts: number;
  premium_per_contract: number;
  notes?: string;
}

export const useLearningPositions = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: positions = [], isLoading, refetch } = useQuery({
    queryKey: ['learning-positions', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('learning_positions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LearningPosition[];
    },
    enabled: !!userId,
  });

  const addPosition = useMutation({
    mutationFn: async (position: NewLearningPosition) => {
      const { data, error } = await supabase
        .from('learning_positions')
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
        .from('learning_positions')
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
        .from('learning_positions')
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
    positions,
    isLoading,
    refetch,
    addPosition: addPosition.mutate,
    closePosition: closePosition.mutate,
    deletePosition: deletePosition.mutate,
  };
};