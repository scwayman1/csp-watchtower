import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfYear } from "date-fns";

export interface ClientMetrics {
  // Real Portfolio
  realPortfolioValue: number;
  realTotalPremium: number;
  realPutPremium: number;
  realAssignedPutPremium: number;
  realCallPremium: number;
  realOpenCspCount: number;
  realAssignedCostBasis: number;
  realCashBalance: number;
  realOtherHoldings: number;
  hasRealPortfolioData: boolean;
  
  // Learning Simulator
  simPortfolioValue: number;
  simTotalPremium: number;
  simYtdPremium: number;
  simOpenCspCount: number;
  simCashSecured: number;
  simAvailableCash: number;
  simSaleProceeds: number;
  simActiveAssignedCost: number;
  startingCapital: number;
  calculatedRisk: string;
  hasSimulatorData: boolean;
  
  // Loading states
  isLoading: boolean;
}

export function useClientMetrics(userId: string | null | undefined): ClientMetrics {
  const yearStart = startOfYear(new Date()).toISOString();

  // ========== REAL PORTFOLIO DATA ==========
  const { data: realPositions, isLoading: realPositionsLoading } = useQuery({
    queryKey: ["client-real-positions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: realAssignedPositions, isLoading: realAssignedLoading } = useQuery({
    queryKey: ["client-real-assigned", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("assigned_positions")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: realCoveredCalls, isLoading: realCallsLoading } = useQuery({
    queryKey: ["client-real-calls", userId],
    queryFn: async () => {
      if (!userId) return [];
      const assignedIds = realAssignedPositions?.map(p => p.id) || [];
      if (assignedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("covered_calls")
        .select("*")
        .in("assigned_position_id", assignedIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && (realAssignedPositions?.length ?? 0) > 0,
  });

  const { data: userSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["client-user-settings", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // ========== LEARNING SIMULATOR DATA ==========
  const { data: learningPositions, isLoading: learningPositionsLoading } = useQuery({
    queryKey: ["client-learning-positions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("learning_positions")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: learningAssignedPositions, isLoading: learningAssignedLoading } = useQuery({
    queryKey: ["client-learning-assigned", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("learning_assigned_positions")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: learningCoveredCalls, isLoading: learningCallsLoading } = useQuery({
    queryKey: ["client-learning-calls", userId],
    queryFn: async () => {
      if (!userId) return [];
      const assignedIds = learningAssignedPositions?.map(p => p.id) || [];
      if (assignedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("learning_covered_calls")
        .select("*")
        .in("learning_assigned_position_id", assignedIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && (learningAssignedPositions?.length ?? 0) > 0,
  });

  const { data: simulatorSettings, isLoading: simSettingsLoading } = useQuery({
    queryKey: ["client-simulator-settings", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("simulator_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // ========== REAL PORTFOLIO CALCULATIONS ==========
  const realPutPremium = (realPositions || []).reduce((sum, pos) => {
    return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
  }, 0);

  const realAssignedPutPremium = (realAssignedPositions || []).reduce((sum, pos) => {
    return sum + parseFloat(String(pos.original_put_premium));
  }, 0);

  const realCallPremium = (realCoveredCalls || []).reduce((sum, call) => {
    return sum + parseFloat(String(call.premium_per_contract)) * parseFloat(String(call.contracts)) * 100;
  }, 0);

  const realTotalPremium = realPutPremium + realAssignedPutPremium + realCallPremium;

  const realOpenCspCount = (realPositions || []).filter(p => p.is_active).length;

  const realAssignedCostBasis = (realAssignedPositions || [])
    .filter(p => p.is_active)
    .reduce((sum, pos) => sum + parseFloat(String(pos.cost_basis)), 0);

  const realCashBalance = parseFloat(String(userSettings?.cash_balance || 0));
  const realOtherHoldings = parseFloat(String(userSettings?.other_holdings_value || 0));
  const realPortfolioValue = realCashBalance + realOtherHoldings + realTotalPremium;

  // ========== LEARNING SIMULATOR CALCULATIONS ==========
  const startingCapital = simulatorSettings?.starting_capital || 100000;

  const simPutPremium = (learningPositions || []).reduce((sum, pos) => {
    return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
  }, 0);

  const simYtdPutPremium = (learningPositions || []).reduce((sum, pos) => {
    if (pos.opened_at >= yearStart) {
      return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
    }
    return sum;
  }, 0);

  const simCallPremium = (learningCoveredCalls || []).reduce((sum, call) => {
    return sum + parseFloat(String(call.premium_per_contract)) * parseFloat(String(call.contracts)) * 100;
  }, 0);

  const simYtdCallPremium = (learningCoveredCalls || []).reduce((sum, pos) => {
    if (pos.opened_at >= yearStart) {
      return sum + parseFloat(String(pos.premium_per_contract)) * parseFloat(String(pos.contracts)) * 100;
    }
    return sum;
  }, 0);

  const simTotalPremium = simPutPremium + simCallPremium;
  const simYtdPremium = simYtdPutPremium + simYtdCallPremium;

  const simOpenCspCount = (learningPositions || []).filter(p => p.is_active).length;

  const simCashSecured = (learningPositions || [])
    .filter(p => p.is_active)
    .reduce((sum, pos) => {
      return sum + parseFloat(String(pos.strike_price)) * parseFloat(String(pos.contracts)) * 100;
    }, 0);

  const simActiveAssignedCost = (learningAssignedPositions || [])
    .filter(p => p.is_active)
    .reduce((sum, pos) => sum + parseFloat(String(pos.cost_basis)), 0);

  const simAllTimeAssignedCost = (learningAssignedPositions || [])
    .reduce((sum, pos) => sum + parseFloat(String(pos.cost_basis)), 0);

  const simSaleProceeds = (learningAssignedPositions || [])
    .filter(p => !p.is_active && p.sold_price)
    .reduce((sum, pos) => {
      return sum + parseFloat(String(pos.sold_price)) * parseFloat(String(pos.shares));
    }, 0);

  const simAvailableCash = startingCapital + simTotalPremium + simSaleProceeds - simCashSecured - simAllTimeAssignedCost;
  const simPortfolioValue = startingCapital + simTotalPremium + simSaleProceeds - simActiveAssignedCost;

  // Risk assessment
  const calculateRisk = () => {
    if (!learningPositions || learningPositions.length === 0) return "Not Set";
    const activePositions = learningPositions.filter(p => p.is_active);
    if (activePositions.length === 0) return "LOW";

    const weeklyTrades = activePositions.filter(p => {
      const expDate = new Date(p.expiration);
      const openDate = new Date(p.opened_at);
      const daysDiff = (expDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });

    const weeklyRatio = weeklyTrades.length / activePositions.length;
    if (weeklyRatio > 0.5) return "HIGH";
    if (weeklyRatio > 0.2) return "MEDIUM";
    return "LOW";
  };

  const calculatedRisk = calculateRisk();

  const hasRealPortfolioData = (realPositions?.length || 0) > 0 || (realAssignedPositions?.length || 0) > 0;
  const hasSimulatorData = (learningPositions?.length || 0) > 0 || (learningAssignedPositions?.length || 0) > 0;

  const isLoading = realPositionsLoading || realAssignedLoading || realCallsLoading || 
    settingsLoading || learningPositionsLoading || learningAssignedLoading || 
    learningCallsLoading || simSettingsLoading;

  return {
    // Real Portfolio
    realPortfolioValue,
    realTotalPremium,
    realPutPremium,
    realAssignedPutPremium,
    realCallPremium,
    realOpenCspCount,
    realAssignedCostBasis,
    realCashBalance,
    realOtherHoldings,
    hasRealPortfolioData,
    
    // Learning Simulator
    simPortfolioValue,
    simTotalPremium,
    simYtdPremium,
    simOpenCspCount,
    simCashSecured,
    simAvailableCash,
    simSaleProceeds,
    simActiveAssignedCost,
    startingCapital,
    calculatedRisk,
    hasSimulatorData,
    
    // Loading states
    isLoading,
  };
}
