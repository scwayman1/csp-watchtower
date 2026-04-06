import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AssignedPosition } from "./types";

async function fetchAssignedPositionsData(userId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const effectiveUserId = userId || user?.id;
  if (!effectiveUserId) return { active: [], closed: [] };

  // Fetch active and closed positions in parallel
  const [activeResult, closedResult] = await Promise.all([
    supabase
      .from('assigned_positions')
      .select('*')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)
      .order('assignment_date', { ascending: false }),
    supabase
      .from('assigned_positions')
      .select('*')
      .eq('user_id', effectiveUserId)
      .eq('is_active', false)
      .not('sold_price', 'is', null)
      .order('closed_at', { ascending: false })
  ]);

  if (activeResult.error) throw activeResult.error;
  if (closedResult.error) throw closedResult.error;

  const positionsData = activeResult.data || [];
  const closedPositionsData = closedResult.data || [];

  if (positionsData.length === 0 && closedPositionsData.length === 0) {
    return { active: [], closed: [] };
  }

  // Fetch covered calls and market data in parallel
  const allPositionIds = [...positionsData.map(p => p.id), ...closedPositionsData.map(p => p.id)];
  const activeSymbols = [...new Set(positionsData.map(p => p.symbol))];

  const [callsResult, marketResult] = await Promise.all([
    supabase
      .from('covered_calls')
      .select('*')
      .in('assigned_position_id', allPositionIds)
      .order('expiration', { ascending: false })
      .order('opened_at', { ascending: false }),
    activeSymbols.length > 0 
      ? supabase
          .from('market_data')
          .select('symbol, underlying_price, day_change_pct')
          .in('symbol', activeSymbols)
      : Promise.resolve({ data: [] })
  ]);

  const callsData = callsResult.data || [];
  const marketData = marketResult.data || [];

  const marketDataMap = new Map<string, { price: number | null; changePct: number | null }>(
    marketData.map(m => [m.symbol, { price: m.underlying_price, changePct: m.day_change_pct }])
  );

  // Enrich active positions
  const enrichedActive = positionsData.map(pos => {
    const marketInfo = marketDataMap.get(pos.symbol);
    const currentPrice = marketInfo?.price || pos.assignment_price;
    const dayChangePct = marketInfo?.changePct || 0;
    const positionValue = currentPrice * pos.shares;
    const totalInvested = pos.cost_basis * pos.shares;
    const unrealizedPnl = positionValue - totalInvested;

    const positionCalls = callsData
      .filter(c => c.assigned_position_id === pos.id)
      .sort((a, b) => {
        const exp = String(b.expiration || '').localeCompare(String(a.expiration || ''));
        if (exp !== 0) return exp;
        return String(b.opened_at || '').localeCompare(String(a.opened_at || ''));
      });
    const totalCallPremiums = positionCalls.reduce((sum, call) => 
      sum + (parseFloat(String(call.premium_per_contract)) * 100 * call.contracts), 0
    );

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
      source: 'assignment',
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
        closed_at: call.closed_at,
      })),
    } as AssignedPosition;
  });

  // Enrich closed positions
  const enrichedClosed = closedPositionsData.map(pos => {
    const soldPrice = parseFloat(String(pos.sold_price || 0));
    const costBasis = parseFloat(String(pos.cost_basis));
    const shares = pos.shares;
    const putPremium = parseFloat(String(pos.original_put_premium));
    
    const positionCalls = callsData
      .filter(c => c.assigned_position_id === pos.id)
      .sort((a, b) => {
        const exp = String(b.expiration || '').localeCompare(String(a.expiration || ''));
        if (exp !== 0) return exp;
        return String(b.opened_at || '').localeCompare(String(a.opened_at || ''));
      });
    const totalCallPremiums = positionCalls.reduce((sum, call) => 
      sum + (parseFloat(String(call.premium_per_contract)) * 100 * call.contracts), 0
    );
    
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
      source: 'assignment',
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
        closed_at: call.closed_at,
      })),
    } as AssignedPosition;
  });

  return { active: enrichedActive, closed: enrichedClosed };
}

export function useAssignedPositionsQueries(userId?: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['assigned-positions', userId],
    queryFn: () => fetchAssignedPositionsData(userId),
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    assignedPositions: data?.active || [],
    closedPositions: data?.closed || [],
    loading: isLoading,
    refetch,
  };
}
