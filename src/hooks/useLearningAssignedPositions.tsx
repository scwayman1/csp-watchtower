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

  // Fetch closed/sold positions for capital gains calculation
  const { data: closedPositions = [] } = useQuery({
    queryKey: ['learning-assigned-positions-closed', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('learning_assigned_positions' as any)
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', false)
        .not('sold_price', 'is', null)
        .order('closed_at', { ascending: false });

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
        .insert([{
          ...data,
          opened_at: new Date().toISOString(),
          is_active: true
        }])
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
      console.error('Covered call error:', error);
      toast({
        title: "Failed to sell covered call",
        description: error instanceof Error ? error.message : JSON.stringify(error),
        variant: "destructive",
      });
    },
  });

  const closeAssignedPosition = useMutation({
    mutationFn: async (data: { id: string; sold_price: number; shares_to_sell?: number }) => {
      // Get the current position to check shares
      const { data: position, error: fetchError } = await supabase
        .from('learning_assigned_positions' as any)
        .select('*')
        .eq('id', data.id)
        .single();

      if (fetchError) throw fetchError;

      const currentShares = (position as any).shares;
      const sharesToSell = data.shares_to_sell || currentShares;
      const remainingShares = currentShares - sharesToSell;
      const currentCostBasis = (position as any).cost_basis;
      const currentPutPremium = (position as any).original_put_premium || 0;
      const proportionSold = sharesToSell / currentShares;

      if (remainingShares <= 0) {
        // Close entire position
        const { error } = await supabase
          .from('learning_assigned_positions' as any)
          .update({
            is_active: false,
            sold_price: data.sold_price,
            closed_at: new Date().toISOString()
          })
          .eq('id', data.id);

        if (error) throw error;
      } else {
        // Partial sale - reduce original position and create a closed record for sold shares
        const soldCostBasis = currentCostBasis * proportionSold;
        const soldPutPremium = currentPutPremium * proportionSold;
        
        // Update original position with remaining shares
        const { error: updateError } = await supabase
          .from('learning_assigned_positions' as any)
          .update({
            shares: remainingShares,
            cost_basis: currentCostBasis - soldCostBasis,
            original_put_premium: currentPutPremium - soldPutPremium,
          })
          .eq('id', data.id);

        if (updateError) throw updateError;

        // Create a closed record for the sold portion to track capital gains
        const { error: insertError } = await supabase
          .from('learning_assigned_positions' as any)
          .insert([{
            user_id: (position as any).user_id,
            symbol: (position as any).symbol,
            shares: sharesToSell,
            assignment_date: (position as any).assignment_date,
            assignment_price: (position as any).assignment_price,
            cost_basis: soldCostBasis,
            original_put_premium: soldPutPremium,
            original_learning_position_id: (position as any).original_learning_position_id,
            is_active: false,
            sold_price: data.sold_price,
            closed_at: new Date().toISOString(),
          }]);

        if (insertError) throw insertError;
      }
      
      return { sharesToSell, soldPrice: data.sold_price };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['learning-assigned-positions', userId] });
      queryClient.invalidateQueries({ queryKey: ['learning-assigned-positions-closed', userId] });
      toast({
        title: "Shares sold",
        description: `Sold ${result.sharesToSell} shares at $${result.soldPrice.toFixed(2)}`,
      });
    },
  });

  return {
    assignedPositions,
    closedPositions,
    isLoading,
    assignPosition: assignPosition.mutate,
    sellCoveredCall: sellCoveredCall.mutate,
    closeAssignedPosition: closeAssignedPosition.mutate,
  };
};