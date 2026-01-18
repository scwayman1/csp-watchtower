import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Position } from "./types";
import { calculateMetrics } from "@/lib/metricsCalculator";

export function usePositionsQueries(userId?: string) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharedOwners, setSharedOwners] = useState<Map<string, string>>(new Map());

  const fetchPositions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const effectiveUserId = userId || user?.id;
      if (!effectiveUserId) return;

      // Fetch positions, market data, option data, and settings in parallel
      const [positionsResult, settingsResult] = await Promise.all([
        supabase
          .from('positions')
          .select('*')
          .order('expiration', { ascending: true }),
        supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', effectiveUserId)
          .maybeSingle()
      ]);

      if (positionsResult.error) throw positionsResult.error;

      const positionsData = positionsResult.data;
      if (!positionsData || positionsData.length === 0) {
        setPositions([]);
        setSharedOwners(new Map());
        setLoading(false);
        return;
      }

      // Parse user settings
      const settings = settingsResult.data ? {
        safe_threshold: settingsResult.data.safe_threshold || 10,
        warning_threshold: settingsResult.data.warning_threshold || 5,
        probability_model: (settingsResult.data.probability_model as 'delta' | 'black-scholes' | 'heuristic') || 'delta',
        volatility_sensitivity: settingsResult.data.volatility_sensitivity || 0.15,
      } : undefined;

      // Track shared positions
      const sharedOwnersMap = new Map<string, string>();
      positionsData.forEach(pos => {
        if (pos.user_id !== effectiveUserId) {
          sharedOwnersMap.set(pos.id, pos.user_id);
        }
      });
      setSharedOwners(sharedOwnersMap);

      // Fetch market data and option data in parallel
      const symbols = [...new Set(positionsData.map(p => p.symbol))];
      const positionIds = positionsData.map(p => p.id);

      const [marketDataResult, optionDataResult] = await Promise.all([
        supabase
          .from('market_data')
          .select('*')
          .in('symbol', symbols),
        supabase
          .from('option_data')
          .select('*')
          .in('position_id', positionIds)
      ]);

      const marketDataMap = new Map(
        marketDataResult.data?.map(m => [m.symbol, {
          price: m.underlying_price,
          dayOpen: m.day_open,
          dayChangePct: m.day_change_pct,
          intradayPrices: m.intraday_prices
        }]) || []
      );

      const optionDataMap = new Map(
        optionDataResult.data?.map(o => [o.position_id, {
          markPrice: o.mark_price,
          bidPrice: o.bid_price,
          askPrice: o.ask_price,
          delta: o.delta,
          impliedVolatility: o.implied_volatility,
        }]) || []
      );

      // Calculate metrics client-side (no edge function calls!)
      const enrichedPositions = positionsData.map((pos) => {
        const marketInfo = marketDataMap.get(pos.symbol);
        const optionInfo = optionDataMap.get(pos.id);
        const underlyingPrice = marketInfo?.price || pos.strike_price * 1.1;

        const metrics = calculateMetrics(
          {
            strike_price: pos.strike_price,
            expiration: pos.expiration,
            premium_per_contract: pos.premium_per_contract,
            contracts: pos.contracts,
            open_fees: pos.open_fees || 0,
          },
          underlyingPrice,
          optionInfo?.markPrice,
          settings
        );

        return {
          id: pos.id,
          symbol: pos.symbol,
          underlyingName: pos.underlying_name || pos.symbol,
          strikePrice: parseFloat(String(pos.strike_price)),
          underlyingPrice,
          expiration: pos.expiration,
          contracts: pos.contracts,
          premiumPerContract: parseFloat(String(pos.premium_per_contract)),
          totalPremium: metrics.totalPremium,
          contractValue: metrics.contractValue,
          unrealizedPnL: metrics.unrealizedPnL,
          daysToExp: metrics.daysToExp,
          pctAboveStrike: metrics.pctAboveStrike,
          probAssignment: metrics.probAssignment,
          statusBand: metrics.statusBand,
          dayChangePct: marketInfo?.dayChangePct || 0,
          intradayPrices: marketInfo?.intradayPrices || [],
        } as Position;
      });

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
  }, [userId]);

  return {
    positions,
    loading,
    sharedOwners,
    refetch: fetchPositions,
  };
}
