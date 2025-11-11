import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Position } from "@/components/dashboard/PositionsTable";

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharedOwners, setSharedOwners] = useState<Map<string, string>>(new Map());

  const fetchPositions = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('is_active', true)
        .order('expiration', { ascending: true });

      if (positionsError) throw positionsError;

      if (!positionsData || positionsData.length === 0) {
        setPositions([]);
        setSharedOwners(new Map());
        setLoading(false);
        return;
      }

      // Track which positions are shared (not owned by current user)
      const sharedOwnersMap = new Map<string, string>();
      positionsData.forEach(pos => {
        if (pos.user_id !== user.id) {
          sharedOwnersMap.set(pos.id, pos.user_id);
        }
      });
      setSharedOwners(sharedOwnersMap);

      // Fetch market data for all symbols
      const symbols = [...new Set(positionsData.map(p => p.symbol))];
      const { data: marketData } = await supabase
        .from('market_data')
        .select('*')
        .in('symbol', symbols);

      const marketDataMap = new Map(
        marketData?.map(m => [m.symbol, {
          price: m.underlying_price,
          dayOpen: m.day_open,
          dayChangePct: m.day_change_pct,
          intradayPrices: m.intraday_prices
        }]) || []
      );

      // Calculate metrics for each position
      const enrichedPositions = await Promise.all(
        positionsData.map(async (pos) => {
          const marketInfo = marketDataMap.get(pos.symbol);
          const underlyingPrice = marketInfo?.price || pos.strike_price * 1.1;

          // Calculate metrics using edge function with user settings
          const { data: metrics } = await supabase.functions.invoke('calculate-metrics', {
            body: { 
              position: pos, 
              underlyingPrice,
              userId: user.id 
            },
          });

          return {
            id: pos.id,
            symbol: pos.symbol,
            underlyingName: pos.underlying_name || pos.symbol,
            strikePrice: parseFloat(String(pos.strike_price)),
            underlyingPrice,
            expiration: pos.expiration,
            contracts: pos.contracts,
            premiumPerContract: parseFloat(String(pos.premium_per_contract)),
            totalPremium: metrics?.totalPremium || parseFloat(String(pos.premium_per_contract)) * 100 * pos.contracts,
            contractValue: metrics?.contractValue || 0,
            unrealizedPnL: metrics?.unrealizedPnL || 0,
            daysToExp: metrics?.daysToExp || 0,
            pctAboveStrike: metrics?.pctAboveStrike || 0,
            probAssignment: metrics?.probAssignment || 0,
            statusBand: (metrics?.statusBand as "success" | "warning" | "destructive") || 'success',
            dayChangePct: marketInfo?.dayChangePct || 0,
            intradayPrices: marketInfo?.intradayPrices || [],
          } as Position;
        })
      );

      setPositions(enrichedPositions);
    } catch (error: any) {
      console.error('Error fetching positions:', error);
      toast({
        title: "Error loading positions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('positions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
        },
        () => {
          fetchPositions();
        }
      )
      .subscribe();

    // Set up market data refresh interval
    const refreshMarketData = async () => {
      try {
        await supabase.functions.invoke('refresh-market-data');
      } catch (error) {
        console.error('Error refreshing market data:', error);
      }
    };

    // Initial fetch
    refreshMarketData();

    // Refresh every 3 minutes to allow time for rate-limited API calls
    const intervalId = setInterval(refreshMarketData, 180000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, []);

  return { positions, loading, refetch: fetchPositions, sharedOwners };
}