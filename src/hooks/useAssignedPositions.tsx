import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface CoveredCall {
  id: string;
  strike_price: number;
  expiration: string;
  premium_per_contract: number;
  contracts: number;
  opened_at: string;
  is_active: boolean;
}

export interface AssignedPosition {
  id: string;
  symbol: string;
  shares: number;
  assignment_date: string;
  assignment_price: number;
  original_put_premium: number;
  original_position_id?: string | null;
  cost_basis: number;
  is_active: boolean;
  current_price?: number;
  day_change_pct?: number;
  unrealized_pnl?: number;
  total_call_premiums?: number;
  net_position?: number;
  covered_calls?: CoveredCall[];
}

export function useAssignedPositions() {
  const [assignedPositions, setAssignedPositions] = useState<AssignedPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignedPositions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch assigned positions
      const { data: positionsData, error: positionsError } = await supabase
        .from('assigned_positions')
        .select('*')
        .eq('is_active', true)
        .order('assignment_date', { ascending: false });

      if (positionsError) throw positionsError;

      if (!positionsData || positionsData.length === 0) {
        setAssignedPositions([]);
        setLoading(false);
        return;
      }

      // Fetch covered calls for each assigned position
      const { data: callsData } = await supabase
        .from('covered_calls')
        .select('*')
        .in('assigned_position_id', positionsData.map(p => p.id));

      // Fetch current market prices
      const symbols = [...new Set(positionsData.map(p => p.symbol))];
      const { data: marketData } = await supabase
        .from('market_data')
        .select('symbol, underlying_price, day_change_pct')
        .in('symbol', symbols);

      const marketDataMap = new Map(
        marketData?.map(m => [m.symbol, { price: m.underlying_price, changePct: m.day_change_pct }]) || []
      );

      // Enrich positions with market data and call premiums
      const enrichedPositions = positionsData.map(pos => {
        const marketInfo = marketDataMap.get(pos.symbol);
        const currentPrice = marketInfo?.price || pos.assignment_price;
        const dayChangePct = marketInfo?.changePct || 0;
        const positionValue = currentPrice * pos.shares;
        const totalInvested = pos.cost_basis * pos.shares;
        const unrealizedPnl = positionValue - totalInvested;

        // Calculate total premiums from covered calls
        const positionCalls = callsData?.filter(c => c.assigned_position_id === pos.id) || [];
        const totalCallPremiums = positionCalls.reduce((sum, call) => 
          sum + (parseFloat(String(call.premium_per_contract)) * 100 * call.contracts), 0
        );

        // Net position = unrealized P/L + original put premium + covered call premiums
        const netPosition = unrealizedPnl + parseFloat(String(pos.original_put_premium)) + totalCallPremiums;

        return {
          id: pos.id,
          symbol: pos.symbol,
          shares: pos.shares,
          assignment_date: pos.assignment_date,
          assignment_price: parseFloat(String(pos.assignment_price)),
          original_put_premium: parseFloat(String(pos.original_put_premium)),
          original_position_id: pos.original_position_id,
          cost_basis: parseFloat(String(pos.cost_basis)),
          is_active: pos.is_active,
          current_price: currentPrice,
          day_change_pct: dayChangePct,
          unrealized_pnl: unrealizedPnl,
          total_call_premiums: totalCallPremiums,
          net_position: netPosition,
          covered_calls: positionCalls.map(call => ({
            id: call.id,
            strike_price: parseFloat(String(call.strike_price)),
            expiration: call.expiration,
            premium_per_contract: parseFloat(String(call.premium_per_contract)),
            contracts: call.contracts,
            opened_at: call.opened_at,
            is_active: call.is_active,
          })),
        } as AssignedPosition;
      });

      setAssignedPositions(enrichedPositions);
    } catch (error: any) {
      console.error('Error fetching assigned positions:', error);
      toast({
        title: "Error loading assigned positions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedPositions();

    // Subscribe to realtime changes
    const assignedChannel = supabase
      .channel('assigned-positions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assigned_positions',
        },
        () => {
          fetchAssignedPositions();
        }
      )
      .subscribe();

    const callsChannel = supabase
      .channel('covered-calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'covered_calls',
        },
        () => {
          fetchAssignedPositions();
        }
      )
      .subscribe();

    // Subscribe to market data changes for real-time price updates
    const marketDataChannel = supabase
      .channel('market-data-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'market_data',
        },
        () => {
          fetchAssignedPositions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assignedChannel);
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(marketDataChannel);
    };
  }, []);

  return { assignedPositions, loading, refetch: fetchAssignedPositions };
}
