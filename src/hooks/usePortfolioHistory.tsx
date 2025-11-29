import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortfolioSnapshot {
  id: string;
  user_id: string;
  portfolio_value: number;
  cash_balance: number;
  positions_value: number;
  assigned_shares_value: number;
  total_premiums_collected: number;
  net_position_pnl: number;
  event_type: string;
  event_description?: string;
  created_at: string;
}

export const usePortfolioHistory = (userId?: string) => {
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['portfolio-history', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('portfolio_history' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as PortfolioSnapshot[];
    },
    enabled: !!userId,
  });

  const recordSnapshot = useMutation({
    mutationFn: async (data: {
      portfolio_value: number;
      cash_balance: number;
      positions_value: number;
      assigned_shares_value: number;
      total_premiums_collected: number;
      net_position_pnl: number;
      event_type: string;
      event_description?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('portfolio_history' as any)
        .insert([{
          ...data,
          user_id: userId,
        }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-history', userId] });
    },
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('portfolio_history' as any)
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-history', userId] });
    },
  });

  return {
    history,
    isLoading,
    recordSnapshot: recordSnapshot.mutateAsync,
    clearHistory: clearHistory.mutate,
  };
};
