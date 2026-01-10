import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, format, differenceInDays, startOfMonth } from "date-fns";

export interface CalledAwayPosition {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number;
  soldPrice: number;
  closedAt: string;
  capitalGain: number;
  callPremium: number;
  totalRealized: number;
  daysHeld: number;
  strikeVsMarket: number; // % difference between strike and market at close
}

export interface UnderwaterPosition {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  unrealizedLoss: number;
  premiumCollected: number; // Premium from covered calls while underwater
  breakEvenProgress: number; // % toward break-even via premiums
  daysUnderwater: number;
}

export interface RecoveredPosition {
  id: string;
  symbol: string;
  shares: number;
  lowestPrice: number;
  recoveryDays: number;
  wasCalledAway: boolean;
  totalPremiumDuringRecovery: number;
}

export interface AssignedAnalytics {
  // Called Away Metrics
  calledAwayPositions: CalledAwayPosition[];
  totalCalledAwayGain: number;
  avgDaysToCalledAway: number;
  strikeEfficiency: number; // Avg % above cost basis at strike
  calledAwayByMonth: { month: string; gain: number; count: number }[];
  
  // Underwater Metrics
  underwaterPositions: UnderwaterPosition[];
  totalUnderwaterExposure: number;
  totalPremiumWhileUnderwater: number;
  avgBreakEvenProgress: number;
  
  // Recovery Patterns
  recoveredPositions: RecoveredPosition[];
  avgRecoveryDays: number;
  recoveryRate: number; // % that recovered vs sold at loss
  
  // Overall Assigned Stats
  totalAssignedEver: number;
  currentlyAssigned: number;
  totalRealizedFromAssignments: number;
}

export function useAssignedAnalytics(userId?: string) {
  const [analytics, setAnalytics] = useState<AssignedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateAnalytics = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all assigned positions
      const { data: assignedPositions, error: apError } = await supabase
        .from('assigned_positions')
        .select('*')
        .eq('user_id', userId);

      if (apError) throw apError;

      // Fetch all covered calls for these positions
      const positionIds = (assignedPositions || []).map(ap => ap.id);
      const { data: coveredCalls, error: ccError } = await supabase
        .from('covered_calls')
        .select('*')
        .in('assigned_position_id', positionIds.length > 0 ? positionIds : ['00000000-0000-0000-0000-000000000000']);

      if (ccError) throw ccError;

      // Fetch current market data for active positions
      const activeSymbols = [...new Set((assignedPositions || [])
        .filter(ap => ap.is_active)
        .map(ap => ap.symbol))];
      
      const { data: marketData, error: mdError } = await supabase
        .from('market_data')
        .select('symbol, underlying_price')
        .in('symbol', activeSymbols.length > 0 ? activeSymbols : ['NONE']);

      if (mdError) throw mdError;

      const marketPriceMap = new Map(
        (marketData || []).map(md => [md.symbol, md.underlying_price || 0])
      );

      // Group covered calls by assigned position
      const callsByPosition = new Map<string, typeof coveredCalls>();
      (coveredCalls || []).forEach(cc => {
        const existing = callsByPosition.get(cc.assigned_position_id) || [];
        existing.push(cc);
        callsByPosition.set(cc.assigned_position_id, existing);
      });

      // Process CALLED AWAY positions (closed with sold_price)
      const calledAwayPositions: CalledAwayPosition[] = [];
      const calledAwayByMonthMap = new Map<string, { gain: number; count: number }>();

      (assignedPositions || []).filter(ap => !ap.is_active && ap.sold_price).forEach(ap => {
        const calls = callsByPosition.get(ap.id) || [];
        const callPremium = calls.reduce((sum, cc) => 
          sum + (parseFloat(String(cc.premium_per_contract)) * cc.contracts * 100), 0);
        
        const capitalGain = (ap.sold_price - ap.cost_basis) * ap.shares;
        const totalRealized = capitalGain + callPremium + ap.original_put_premium;
        
        const daysHeld = ap.closed_at 
          ? differenceInDays(parseISO(ap.closed_at), parseISO(ap.assignment_date))
          : 0;
        
        // Strike vs market at close (approximate using sold_price as strike)
        const strikeVsMarket = ap.cost_basis > 0 
          ? ((ap.sold_price - ap.cost_basis) / ap.cost_basis) * 100
          : 0;

        calledAwayPositions.push({
          id: ap.id,
          symbol: ap.symbol,
          shares: ap.shares,
          costBasis: ap.cost_basis,
          soldPrice: ap.sold_price,
          closedAt: ap.closed_at || ap.assignment_date,
          capitalGain,
          callPremium,
          totalRealized,
          daysHeld,
          strikeVsMarket,
        });

        // Monthly aggregation
        const monthKey = format(startOfMonth(parseISO(ap.closed_at || ap.assignment_date)), "yyyy-MM");
        const existing = calledAwayByMonthMap.get(monthKey) || { gain: 0, count: 0 };
        calledAwayByMonthMap.set(monthKey, {
          gain: existing.gain + totalRealized,
          count: existing.count + 1,
        });
      });

      const calledAwayByMonth = Array.from(calledAwayByMonthMap.entries())
        .map(([month, data]) => ({
          month: format(parseISO(month + "-01"), "MMM yyyy"),
          ...data,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const totalCalledAwayGain = calledAwayPositions.reduce((sum, p) => sum + p.totalRealized, 0);
      const avgDaysToCalledAway = calledAwayPositions.length > 0
        ? calledAwayPositions.reduce((sum, p) => sum + p.daysHeld, 0) / calledAwayPositions.length
        : 0;
      const strikeEfficiency = calledAwayPositions.length > 0
        ? calledAwayPositions.reduce((sum, p) => sum + p.strikeVsMarket, 0) / calledAwayPositions.length
        : 0;

      // Process UNDERWATER positions (active, current price < cost basis)
      const underwaterPositions: UnderwaterPosition[] = [];

      (assignedPositions || []).filter(ap => ap.is_active).forEach(ap => {
        const currentPrice = marketPriceMap.get(ap.symbol) || 0;
        if (currentPrice > 0 && currentPrice < ap.cost_basis) {
          const calls = callsByPosition.get(ap.id) || [];
          const premiumCollected = calls.reduce((sum, cc) => 
            sum + (parseFloat(String(cc.premium_per_contract)) * cc.contracts * 100), 0);
          
          const unrealizedLoss = (ap.cost_basis - currentPrice) * ap.shares;
          const totalLossToRecover = unrealizedLoss;
          const breakEvenProgress = totalLossToRecover > 0 
            ? Math.min(100, (premiumCollected / totalLossToRecover) * 100)
            : 100;
          
          const daysUnderwater = differenceInDays(new Date(), parseISO(ap.assignment_date));

          underwaterPositions.push({
            id: ap.id,
            symbol: ap.symbol,
            shares: ap.shares,
            costBasis: ap.cost_basis,
            currentPrice,
            unrealizedLoss,
            premiumCollected,
            breakEvenProgress,
            daysUnderwater,
          });
        }
      });

      const totalUnderwaterExposure = underwaterPositions.reduce((sum, p) => sum + p.unrealizedLoss, 0);
      const totalPremiumWhileUnderwater = underwaterPositions.reduce((sum, p) => sum + p.premiumCollected, 0);
      const avgBreakEvenProgress = underwaterPositions.length > 0
        ? underwaterPositions.reduce((sum, p) => sum + p.breakEvenProgress, 0) / underwaterPositions.length
        : 0;

      // Recovery patterns (positions that were underwater but recovered/called away)
      const recoveredPositions: RecoveredPosition[] = [];
      
      // For now, consider called away positions as "recovered"
      calledAwayPositions.filter(p => p.capitalGain >= 0).forEach(p => {
        recoveredPositions.push({
          id: p.id,
          symbol: p.symbol,
          shares: p.shares,
          lowestPrice: p.costBasis * 0.9, // Approximate
          recoveryDays: p.daysHeld,
          wasCalledAway: true,
          totalPremiumDuringRecovery: p.callPremium,
        });
      });

      const avgRecoveryDays = recoveredPositions.length > 0
        ? recoveredPositions.reduce((sum, p) => sum + p.recoveryDays, 0) / recoveredPositions.length
        : 0;
      
      const lossPositions = calledAwayPositions.filter(p => p.capitalGain < 0).length;
      const totalClosedPositions = calledAwayPositions.length;
      const recoveryRate = totalClosedPositions > 0 
        ? ((totalClosedPositions - lossPositions) / totalClosedPositions) * 100
        : 0;

      // Overall stats
      const totalAssignedEver = (assignedPositions || []).length;
      const currentlyAssigned = (assignedPositions || []).filter(ap => ap.is_active).length;
      const totalRealizedFromAssignments = totalCalledAwayGain;

      setAnalytics({
        calledAwayPositions,
        totalCalledAwayGain,
        avgDaysToCalledAway,
        strikeEfficiency,
        calledAwayByMonth,
        underwaterPositions,
        totalUnderwaterExposure,
        totalPremiumWhileUnderwater,
        avgBreakEvenProgress,
        recoveredPositions,
        avgRecoveryDays,
        recoveryRate,
        totalAssignedEver,
        currentlyAssigned,
        totalRealizedFromAssignments,
      });

    } catch (err: any) {
      console.error('[AssignedAnalytics] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    calculateAnalytics();
  }, [calculateAnalytics]);

  return { analytics, loading, error, refetch: calculateAnalytics };
}
