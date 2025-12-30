import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLearningMarketData } from "./useLearningMarketData";
import { useMemo } from "react";

export interface LearningExpiredPosition {
  id: string;
  user_id: string;
  symbol: string;
  strike_price: number;
  expiration: string;
  contracts: number;
  premium_per_contract: number;
  opened_at: string;
  closed_at: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Calculated fields
  totalPremium: number;
  underlyingPrice: number;
}

export const useLearningExpiredPositions = (userId?: string) => {
  const { data: expiredPositions = [], isLoading } = useQuery({
    queryKey: ['learning-expired-positions', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Get closed positions
      const { data: positions, error: posError } = await supabase
        .from('learning_positions' as any)
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', false)
        .order('expiration', { ascending: false });

      if (posError) throw posError;
      
      // Get assigned position IDs to exclude (these are tracked separately)
      const { data: assignedPositions, error: apError } = await supabase
        .from('learning_assigned_positions' as any)
        .select('original_learning_position_id')
        .eq('user_id', userId)
        .not('original_learning_position_id', 'is', null);

      if (apError) throw apError;
      
      // Filter out positions that were assigned (to avoid double-counting premiums)
      const assignedIds = new Set((assignedPositions || []).map((ap: any) => ap.original_learning_position_id));
      const expiredOnly = (positions || []).filter((p: any) => !assignedIds.has(p.id));
      
      return expiredOnly as unknown as LearningExpiredPosition[];
    },
    enabled: !!userId,
  });

  // Get unique symbols for market data
  const symbols = useMemo(() => {
    return [...new Set(expiredPositions.map(p => p.symbol))];
  }, [expiredPositions]);

  const { data: marketData = {} } = useLearningMarketData(symbols);

  // Enhance positions with calculated fields
  const enhancedPositions = useMemo(() => {
    return expiredPositions.map(pos => ({
      ...pos,
      totalPremium: pos.premium_per_contract * 100 * pos.contracts,
      underlyingPrice: marketData[pos.symbol]?.price || 0,
    }));
  }, [expiredPositions, marketData]);

  // Group by expiration date (batch)
  const batches = useMemo(() => {
    const grouped = enhancedPositions.reduce((acc, pos) => {
      const key = pos.expiration;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(pos);
      return acc;
    }, {} as Record<string, LearningExpiredPosition[]>);

    // Sort batches by date descending
    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([date, positions]) => ({
        date,
        positions,
        totalPremium: positions.reduce((sum, p) => sum + p.totalPremium, 0),
        totalContracts: positions.reduce((sum, p) => sum + p.contracts, 0),
      }));
  }, [enhancedPositions]);

  return {
    expiredPositions: enhancedPositions,
    batches,
    isLoading,
  };
};
