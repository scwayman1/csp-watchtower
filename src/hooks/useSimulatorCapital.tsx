import { useMemo } from "react";
import { useLearningPositions } from "./useLearningPositions";
import { useLearningAssignedPositions } from "./useLearningAssignedPositions";
import { useLearningExpiredPositions } from "./useLearningExpiredPositions";
import { useSimulatorSettings } from "./useSimulatorSettings";

export interface SimulatorCapitalState {
  startingCapital: number;
  totalCashSecured: number;
  totalAssignedCostBasis: number;
  totalPremiums: number;
  totalSaleProceeds: number;
  availableCapital: number;
  isLoading: boolean;
}

export const useSimulatorCapital = (userId?: string): SimulatorCapitalState => {
  const { positions, isLoading: positionsLoading } = useLearningPositions(userId);
  const { assignedPositions, closedPositions, isLoading: assignedLoading } = useLearningAssignedPositions(userId);
  const { expiredPositions, isLoading: expiredLoading } = useLearningExpiredPositions(userId);
  const { settings, isLoading: settingsLoading } = useSimulatorSettings(userId);

  const calculatedState = useMemo(() => {
    const startingCapital = settings?.starting_capital || 100000;

    // Active positions cash secured
    const activePositions = positions.filter(p => p.is_active);
    const totalCashSecured = activePositions.reduce(
      (sum, p) => sum + (parseFloat(String(p.strike_price)) * 100 * p.contracts), 
      0
    );

    // Active put premiums
    const totalPutPremiums = activePositions.reduce(
      (sum, p) => sum + (parseFloat(String(p.premium_per_contract)) * 100 * p.contracts), 
      0
    );

    // Expired positions premium
    const totalExpiredPremiums = expiredPositions.reduce(
      (sum, p) => sum + (parseFloat(String(p.premium_per_contract)) * 100 * p.contracts), 
      0
    );

    // Assigned positions cost basis and premiums
    const totalAssignedCostBasis = assignedPositions.reduce(
      (sum, ap) => sum + parseFloat(String(ap.cost_basis)), 
      0
    );

    const totalAssignedPutPremiums = assignedPositions.reduce(
      (sum, ap) => sum + parseFloat(String(ap.original_put_premium)), 
      0
    );

    // Covered call premiums from active assigned positions
    const totalCallPremiums = assignedPositions.reduce((sum, ap) => {
      const calls = (ap as any).covered_calls || [];
      const ccPremiums = calls.reduce(
        (ccSum: number, cc: any) => ccSum + (parseFloat(String(cc.premium_per_contract)) * 100 * cc.contracts),
        0
      );
      return sum + ccPremiums;
    }, 0);

    // Closed assigned positions' premiums
    const totalClosedAssignedPutPremiums = closedPositions.reduce(
      (sum, cp) => sum + parseFloat(String(cp.original_put_premium)), 
      0
    );

    const totalClosedCallPremiums = closedPositions.reduce((sum, cp) => {
      const calls = (cp as any).covered_calls || [];
      const ccPremiums = calls.reduce(
        (ccSum: number, cc: any) => ccSum + (parseFloat(String(cc.premium_per_contract)) * 100 * cc.contracts),
        0
      );
      return sum + ccPremiums;
    }, 0);

    // Total premiums from all sources
    const totalPremiums = 
      totalPutPremiums + 
      totalExpiredPremiums + 
      totalAssignedPutPremiums + 
      totalClosedAssignedPutPremiums + 
      totalCallPremiums + 
      totalClosedCallPremiums;

    // Sale proceeds from closed positions
    const totalSaleProceeds = closedPositions.reduce((sum, cp) => {
      if (cp.sold_price && cp.shares) {
        return sum + (parseFloat(String(cp.sold_price)) * cp.shares);
      }
      return sum;
    }, 0);

    // Available Capital = Starting Capital - Cash Secured - Assigned Cost Basis + Premiums + Sale Proceeds
    const availableCapital = startingCapital - totalCashSecured - totalAssignedCostBasis + totalPremiums + totalSaleProceeds;

    return {
      startingCapital,
      totalCashSecured,
      totalAssignedCostBasis,
      totalPremiums,
      totalSaleProceeds,
      availableCapital,
    };
  }, [positions, assignedPositions, closedPositions, expiredPositions, settings]);

  return {
    ...calculatedState,
    isLoading: positionsLoading || assignedLoading || expiredLoading || settingsLoading,
  };
};

// Helper function to check if a new position can be afforded
export const canAffordPosition = (
  availableCapital: number, 
  strikePrice: number, 
  contracts: number,
  premiumPerContract: number
): { canAfford: boolean; requiredCapital: number; shortfall: number; warningLevel: 'none' | 'low' | 'critical' } => {
  const requiredCapital = strikePrice * 100 * contracts;
  const premiumReceived = premiumPerContract * 100 * contracts;
  const netRequired = requiredCapital - premiumReceived;
  
  const canAfford = availableCapital >= netRequired;
  const shortfall = canAfford ? 0 : netRequired - availableCapital;
  
  // Warning levels based on remaining capital after trade
  const remainingAfterTrade = availableCapital - netRequired;
  const warningLevel: 'none' | 'low' | 'critical' = 
    !canAfford ? 'critical' :
    remainingAfterTrade < 10000 ? 'low' : 'none';
  
  return { canAfford, requiredCapital, shortfall, warningLevel };
};
