import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LearningCoveredCall {
  id: string;
  learning_assigned_position_id: string;
  strike_price: number;
  expiration: string;
  premium_per_contract: number;
  contracts: number;
  opened_at: string;
  closed_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningAssignedPosition {
  id: string;
  user_id: string;
  symbol: string;
  shares: number;
  assignment_date: string;
  assignment_price: number;
  cost_basis: number;
  original_learning_position_id?: string;
  original_put_premium: number;
  is_active: boolean;
  sold_price?: number;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  covered_calls?: LearningCoveredCall[];
}

export const useLearningAssignedPositions = (userId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const assignPosition = useMutation({
    mutationFn: async (data: {
      symbol: string;
      shares: number;
      assignment_price: number;
      original_put_premium: number;
      original_learning_position_id?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('learning_assigned_positions' as any)
        .insert([{
          ...data,
          user_id: userId,
          assignment_date: new Date().toISOString(),
          cost_basis: data.assignment_price * data.shares
        }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-assigned-positions', userId] });
      toast({
        title: "Position assigned",
        description: "Shares added to simulator portfolio",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to assign position",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const sellCoveredCall = useMutation({
    mutationFn: async (data: {
      learning_assigned_position_id: string;
      strike_price: number;
      expiration: string;
      premium_per_contract: number;
      contracts: number;
    }) => {
      const { data: result, error } = await supabase
        .from('learning_covered_calls' as any)
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-assigned-positions', userId] });
      toast({
        title: "Covered call sold",
        description: "Call option added to assigned position",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to sell covered call",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const closeAssignedPosition = useMutation({
    mutationFn: async (data: { id: string; sold_price: number }) => {
      const { error } = await supabase
        .from('learning_assigned_positions' as any)
        .update({
          is_active: false,
          sold_price: data.sold_price,
          closed_at: new Date().toISOString()
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-assigned-positions', userId] });
      toast({
        title: "Position closed",
        description: "Assigned position sold",
      });
    },
  });

  return {
    assignedPositions,
    isLoading,
    assignPosition: assignPosition.mutate,
    sellCoveredCall: sellCoveredCall.mutate,
    closeAssignedPosition: closeAssignedPosition.mutate,
  };
};