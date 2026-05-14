export interface AccountingPosition {
  id: string;
  symbol: string;
  premiumPerContract: number;
  contracts: number;
  expiration: string;
  isActive: boolean;
}

export interface AccountingAssignedPosition {
  id: string;
  symbol: string;
  shares: number;
  originalPutPremium: number;
  originalPositionId?: string | null;
  assignmentDate: string;
  assignmentPrice: number;
  costBasis: number;
  isActive: boolean;
  currentPrice?: number | null;
  soldPrice?: number | null;
}

export interface AccountingCoveredCall {
  id: string;
  assignedPositionId: string;
  symbol?: string;
  premiumPerContract: number;
  contracts: number;
  expiration: string;
  openedAt: string;
  isActive: boolean;
  closedAt?: string | null;
}

export interface PremiumBreakdown {
  activePutPremium: number;
  activePutCount: number;
  expiredPutPremium: number;
  expiredPutCount: number;
  assignedPutPremium: number;
  assignedPutCount: number;
  activeCallPremium: number;
  activeCallCount: number;
  closedCallPremium: number;
  closedCallCount: number;
  totalPutPremium: number;
  totalCallPremium: number;
  totalPremium: number;
}

export interface CalculatePremiumBreakdownInput {
  asOfDate?: string;
  positions: AccountingPosition[];
  assignedPositions: AccountingAssignedPosition[];
  coveredCalls: AccountingCoveredCall[];
}

export interface PortfolioAccountingInput {
  cashBalance: number;
  otherHoldingsValue: number;
  brokerAccountValue?: number | null;
  assignedShareMarketValue: number;
  assignedShareCostBasis: number;
  activePutRequirement: number;
  activePutMarkValue: number;
  totalPremiumsCollected: number;
  realizedCapitalGains: number;
  activeOptionUnrealizedPnl: number;
}

export interface PortfolioAccountingResult {
  portfolioValue: number;
  availableCash: number;
  cashBalance: number;
  otherHoldingsValue: number;
  assignedShareMarketValue: number;
  assignedShareCostBasis: number;
  activePutRequirement: number;
  activePutMarkValue: number;
  performance: {
    totalPremiumsCollected: number;
    realizedCapitalGains: number;
    unrealizedAssignedSharePnl: number;
    activeOptionUnrealizedPnl: number;
    totalRealizedIncome: number;
  };
}

export type PutExpirationOutcome = "assigned" | "expired_worthless" | "needs_reconciliation";
export type CoveredCallExpirationOutcome = "called_away" | "expired_worthless" | "needs_reconciliation";

function money(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function optionPremium(premiumPerContract: number, contracts: number): number {
  return money((Number(premiumPerContract) || 0) * (Number(contracts) || 0) * 100);
}

function dateOnly(value?: string | null): string {
  return String(value || "").slice(0, 10);
}

export function calculatePremiumBreakdown({
  asOfDate = new Date().toISOString().slice(0, 10),
  positions,
  assignedPositions,
  coveredCalls,
}: CalculatePremiumBreakdownInput): PremiumBreakdown {
  const assignedOriginalPositionIds = new Set(
    assignedPositions
      .map((position) => position.originalPositionId)
      .filter((id): id is string => Boolean(id))
  );

  let activePutPremium = 0;
  let activePutCount = 0;
  let expiredPutPremium = 0;
  let expiredPutCount = 0;
  let assignedPutPremium = 0;
  let assignedPutCount = 0;
  let activeCallPremium = 0;
  let activeCallCount = 0;
  let closedCallPremium = 0;
  let closedCallCount = 0;

  for (const position of positions) {
    const premium = optionPremium(position.premiumPerContract, position.contracts);
    const isExpired = dateOnly(position.expiration) < asOfDate;
    const wasAssigned = assignedOriginalPositionIds.has(position.id);

    if (!isExpired && position.isActive) {
      activePutPremium += premium;
      activePutCount += position.contracts;
    } else if (isExpired && !wasAssigned) {
      expiredPutPremium += premium;
      expiredPutCount += position.contracts;
    }
  }

  for (const position of assignedPositions) {
    assignedPutPremium += Number(position.originalPutPremium) || 0;
    assignedPutCount += Math.floor((Number(position.shares) || 0) / 100);
  }

  for (const call of coveredCalls) {
    const premium = optionPremium(call.premiumPerContract, call.contracts);
    const isExpired = dateOnly(call.expiration) < asOfDate;
    const isTrulyActive = call.isActive && !call.closedAt && !isExpired;

    if (isTrulyActive) {
      activeCallPremium += premium;
      activeCallCount += call.contracts;
    } else {
      closedCallPremium += premium;
      closedCallCount += call.contracts;
    }
  }

  activePutPremium = money(activePutPremium);
  expiredPutPremium = money(expiredPutPremium);
  assignedPutPremium = money(assignedPutPremium);
  activeCallPremium = money(activeCallPremium);
  closedCallPremium = money(closedCallPremium);

  const totalPutPremium = money(activePutPremium + expiredPutPremium + assignedPutPremium);
  const totalCallPremium = money(activeCallPremium + closedCallPremium);

  return {
    activePutPremium,
    activePutCount,
    expiredPutPremium,
    expiredPutCount,
    assignedPutPremium,
    assignedPutCount,
    activeCallPremium,
    activeCallCount,
    closedCallPremium,
    closedCallCount,
    totalPutPremium,
    totalCallPremium,
    totalPremium: money(totalPutPremium + totalCallPremium),
  };
}

export function calculatePortfolioAccounting(input: PortfolioAccountingInput): PortfolioAccountingResult {
  const cashBalance = money(input.cashBalance);
  const otherHoldingsValue = money(input.otherHoldingsValue);
  const assignedShareMarketValue = money(input.assignedShareMarketValue);
  const assignedShareCostBasis = money(input.assignedShareCostBasis);
  const activePutRequirement = money(input.activePutRequirement);
  const activePutMarkValue = money(input.activePutMarkValue);
  const brokerAccountValue = input.brokerAccountValue ?? null;

  const explicitAssetValue = money(
    cashBalance + otherHoldingsValue + assignedShareMarketValue - activePutMarkValue
  );

  const portfolioValue = money(
    brokerAccountValue && brokerAccountValue > 0 ? brokerAccountValue : explicitAssetValue
  );

  const unrealizedAssignedSharePnl = money(assignedShareMarketValue - assignedShareCostBasis);
  const totalPremiumsCollected = money(input.totalPremiumsCollected);
  const realizedCapitalGains = money(input.realizedCapitalGains);

  return {
    portfolioValue,
    availableCash: money(Math.max(0, cashBalance - activePutRequirement)),
    cashBalance,
    otherHoldingsValue,
    assignedShareMarketValue,
    assignedShareCostBasis,
    activePutRequirement,
    activePutMarkValue,
    performance: {
      totalPremiumsCollected,
      realizedCapitalGains,
      unrealizedAssignedSharePnl,
      activeOptionUnrealizedPnl: money(input.activeOptionUnrealizedPnl),
      totalRealizedIncome: money(totalPremiumsCollected + realizedCapitalGains),
    },
  };
}

export function classifyPutExpiration({
  strikePrice,
  expirationClosePrice,
}: {
  strikePrice: number;
  expirationClosePrice?: number | null;
}): { outcome: PutExpirationOutcome } {
  if (expirationClosePrice === undefined || expirationClosePrice === null) {
    return { outcome: "needs_reconciliation" };
  }

  return { outcome: expirationClosePrice < strikePrice ? "assigned" : "expired_worthless" };
}

export function classifyCoveredCallExpiration({
  strikePrice,
  expirationClosePrice,
}: {
  strikePrice: number;
  expirationClosePrice?: number | null;
  currentPrice?: number | null;
  expiration?: string;
  asOfDate?: string;
}): { outcome: CoveredCallExpirationOutcome } {
  if (expirationClosePrice === undefined || expirationClosePrice === null) {
    return { outcome: "needs_reconciliation" };
  }

  return { outcome: expirationClosePrice > strikePrice ? "called_away" : "expired_worthless" };
}
