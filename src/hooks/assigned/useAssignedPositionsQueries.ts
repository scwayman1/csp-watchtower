import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AssignedPosition } from "./types";

export function useAssignedPositionsQueries(userId?: string) {
  const [assignedPositions, setAssignedPositions] = useState<AssignedPosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<AssignedPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignedPositions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const effectiveUserId = userId || user?.id;
      if (!effectiveUserId) return;

      // Fetch active assigned positions
      const { data: activeData, error: activeError } = await supabase
        .from('assigned_positions')
        .select('*')
        .eq('is_active', true)
        .order('assignment_date', { ascending: false });

      if (activeError) throw activeError;

      // Fetch closed (called away) positions
      const { data: closedData, error: closedError } = await supabase
        .from('assigned_positions')
        .select('*')
        .eq('is_active', false)
        .not('sold_price', 'is', null)
        .order('closed_at', { ascending: false });

      if (closedError) throw closedError;

      const positionsData = activeData || [];
      const closedPositionsData = closedData || [];

      if (positionsData.length === 0 && closedPositionsData.length === 0) {
        setAssignedPositions([]);
        setClosedPositions([]);
        setLoading(false);
        return;
      }

      // Fetch covered calls for all positions (active and closed)
      const allPositionIds = [...positionsData.map(p => p.id), ...closedPositionsData.map(p => p.id)];
      const { data: callsData } = await supabase
        .from('covered_calls')
        .select('*')
        .in('assigned_position_id', allPositionIds);

      // Fetch current market prices for active positions
      const activeSymbols = [...new Set(positionsData.map(p => p.symbol))];
      const { data: marketData } = activeSymbols.length > 0 ? await supabase
        .from('market_data')
        .select('symbol, underlying_price, day_change_pct')
        .in('symbol', activeSymbols) : { data: [] };

      const marketDataMap = new Map<string, { price: number | null; changePct: number | null }>(
        marketData?.map(m => [m.symbol, { price: m.underlying_price, changePct: m.day_change_pct }] as [string, { price: number | null; changePct: number | null }]) || []
      );

      // Enrich active positions with market data and call premiums
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
          sold_price: pos.sold_price ? parseFloat(String(pos.sold_price)) : null,
          closed_at: pos.closed_at,
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

      // Enrich closed positions with realized P/L
      const enrichedClosedPositions = closedPositionsData.map(pos => {
        const soldPrice = parseFloat(String(pos.sold_price || 0));
        const costBasis = parseFloat(String(pos.cost_basis));
        const shares = pos.shares;
        const putPremium = parseFloat(String(pos.original_put_premium));
        
        // Get total call premiums collected
        const positionCalls = callsData?.filter(c => c.assigned_position_id === pos.id) || [];
        const totalCallPremiums = positionCalls.reduce((sum, call) => 
          sum + (parseFloat(String(call.premium_per_contract)) * 100 * call.contracts), 0
        );
        
        // Realized P/L = (Sold Price - Cost Basis) × Shares + Call Premiums
        const capitalGain = (soldPrice - costBasis) * shares;
        const realizedPnl = capitalGain + totalCallPremiums;

        return {
          id: pos.id,
          symbol: pos.symbol,
          shares: shares,
          assignment_date: pos.assignment_date,
          assignment_price: parseFloat(String(pos.assignment_price)),
          original_put_premium: putPremium,
          original_position_id: pos.original_position_id,
          cost_basis: costBasis,
          is_active: false,
          sold_price: soldPrice,
          closed_at: pos.closed_at,
          current_price: soldPrice,
          realized_pnl: realizedPnl,
          total_call_premiums: totalCallPremiums,
          net_position: realizedPnl,
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
      setClosedPositions(enrichedClosedPositions);
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
  }, [userId]);

  return {
    assignedPositions,
    closedPositions,
    loading,
    refetch: fetchAssignedPositions,
  };
}
