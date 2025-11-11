import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Position } from "@/components/dashboard/PositionsTable";

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPositions = async () => {
    try {
      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('is_active', true)
        .order('expiration', { ascending: true });

      if (positionsError) throw positionsError;

      if (!positionsData || positionsData.length === 0) {
        setPositions([]);
        setLoading(false);
        return;
      }

      // Fetch market data for all symbols
      const symbols = [...new Set(positionsData.map(p => p.symbol))];
      const { data: marketData } = await supabase
        .from('market_data')
        .select('*')
        .in('symbol', symbols);

      const marketDataMap = new Map(
        marketData?.map(m => [m.symbol, m.underlying_price]) || []
      );

      // Calculate metrics for each position
      const enrichedPositions = await Promise.all(
        positionsData.map(async (pos) => {
          const underlyingPrice = marketDataMap.get(pos.symbol) || pos.strike_price * 1.1;

          // Calculate metrics using edge function
          const { data: metrics } = await supabase.functions.invoke('calculate-metrics', {
            body: { position: pos, underlyingPrice },
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { positions, loading, refetch: fetchPositions };
}