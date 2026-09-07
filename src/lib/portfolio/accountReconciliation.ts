export type ReconciliationOptionType = "PUT" | "CALL";
export type ReconciliationLifecycleEventType = "called_away" | "stock_sale" | "assigned" | "expired";
export type ReconciliationCashEventType =
  | "dividend"
  | "interest"
  | "deposit"
  | "withdrawal"
  | "reinvestment"
  | "fee"
  | "transfer_in"
  | "transfer_out"
  | "security_trade"
  | "corporate_action";

export interface ReconciliationBaseline {
  asOfDate: string;
  brokerAccountValue: number;
  cashBalance: number;
  cumulativePremium: number;
  realizedPremium: number;
  realizedCapitalGain: number;
  openPremium: number;
  optionLiability: number;
}

export interface ReconciliationEquityHolding {
  symbol: string;
  shares: number;
  marketValue: number;
  unrealizedPnl: number;
  costBasis?: number | null;
  price?: number | null;
  holdingKey?: string;
  holdingCategory?: "equity" | "etp" | "cash_equivalent" | "purchased_or_transferred" | "other";
  sourceEventKey?: string;
  sourceDocument?: string;
  sourcePage?: number;
}

export interface ReconciliationOptionHolding {
  symbol: string;
  type: ReconciliationOptionType;
  contracts: number;
  premiumCollected: number;
  marketValue: number;
  unrealizedPnl?: number;
  alreadyInBaseline?: boolean;
}

export interface ReconciliationCurrentHoldings {
  asOfDate: string;
  cashBalance: number;
  equities: ReconciliationEquityHolding[];
  options: ReconciliationOptionHolding[];
}

export interface ReconciliationLifecycleEvent {
  symbol: string;
  eventType: ReconciliationLifecycleEventType;
  shares: number;
  price: number;
  costBasisPerShare: number;
  sourceEventKey?: string;
  sourceDocument?: string;
  sourcePage?: number;
}

export interface ReconciliationCashEvent {
  eventType: ReconciliationCashEventType;
  amount: number;
  eventDate: string;
  alreadyInBaseline?: boolean;
  sourceEventKey?: string;
  sourceDocument?: string;
  sourcePage?: number;
  symbol?: string | null;
  shares?: number | null;
  price?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ReconciliationAccountingEvent extends ReconciliationCashEvent {
  eventCategory: "income" | "fee" | "external_flow" | "security_trade" | "reinvestment" | "corporate_action" | "other";
}

export interface ReconciliationPremiumEvent {
  eventDate: string;
  symbol: string;
  side: ReconciliationOptionType;
  expiration: string;
  strikePrice: number;
  contracts: number;
  quotedPremiumPerShare: number;
  statementAmount: number;
  feeAmount?: number;
  sourceEventKey: string;
  sourceDocument: string;
  sourcePage: number;
}

export interface ReconciliationCoveredCall {
  symbol: string;
  expiration: string;
  strikePrice: number;
  contracts: number;
  premiumPerContract: number;
  openedAt?: string | null;
  closedAt?: string | null;
  status?: "open" | "closed" | "expired" | "assigned" | "needs_review";
  underlyingSource?: "assigned_position" | "reconciliation_holding" | "purchased_or_transferred" | "unknown";
  assignedPositionId?: string | null;
  underlyingHoldingKey?: string | null;
  sourceEventKey: string;
  metadata?: Record<string, unknown>;
}

export interface AccountReconciliationSummaryInput {
  baseline: ReconciliationBaseline;
  currentHoldings: ReconciliationCurrentHoldings;
  lifecycleEvents: ReconciliationLifecycleEvent[];
  cashEvents: ReconciliationCashEvent[];
  accountingEvents?: ReconciliationAccountingEvent[];
  premiumEvents?: ReconciliationPremiumEvent[];
  reconciliationCoveredCalls?: ReconciliationCoveredCall[];
}

export interface AccountReconciliationSummary {
  baselineAsOfDate: string;
  currentAsOfDate: string;
  currentAum: number;
  currentCashBalance: number;
  currentEquityMarketValue: number;
  currentOptionLiability: number;
  currentOpenPremium: number;
  postBaselineOpenPremium: number;
  currentOpenPutPremium: number;
  currentOpenCallPremium: number;
  cumulativePremiumToDate: number;
  realizedPremiumToDate: number;
  realizedCapitalGainToDate: number;
  lifecycleRealizedCapitalGain: number;
  totalRealizedPnl: number;
  currentEquityUnrealizedPnl: number;
  currentOptionUnrealizedPnl: number;
  currentUnrealizedPnl: number;
  totalStrategyPnl: number;
  postBaselineCashIncome: number;
  postBaselineCashFees: number;
  postBaselineExternalFlows: number;
  postBaselineReinvestments: number;
  postBaselineOtherCashActivity: number;
  reconciliationCoveredCallPremium: number;
  statementPremiumGross: number;
  statementPremiumNetSettlement: number;
  statementPremiumFees: number;
  redundantCashEventsTotal: number;
}

function money(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return money(items.reduce((sum, item) => sum + (Number(selector(item)) || 0), 0));
}

function optionUnrealizedPnl(option: ReconciliationOptionHolding): number {
  if (option.unrealizedPnl !== undefined && option.unrealizedPnl !== null) {
    return Number(option.unrealizedPnl) || 0;
  }

  return money(option.premiumCollected + option.marketValue);
}

export function buildAccountReconciliationSummary({
  baseline,
  currentHoldings,
  lifecycleEvents,
  cashEvents,
  accountingEvents = [],
  premiumEvents = [],
  reconciliationCoveredCalls = [],
}: AccountReconciliationSummaryInput): AccountReconciliationSummary {
  const allCashEvents = [...cashEvents, ...accountingEvents];
  const currentCashBalance = money(currentHoldings.cashBalance);
  const currentEquityMarketValue = sumBy(currentHoldings.equities, (holding) => holding.marketValue);
  const currentOptionLiability = sumBy(currentHoldings.options, (option) => option.marketValue);
  const currentOpenPremium = sumBy(currentHoldings.options, (option) => option.premiumCollected);
  const postBaselineOpenPremium = sumBy(
    currentHoldings.options.filter((option) => option.alreadyInBaseline !== true),
    (option) => option.premiumCollected
  );
  const currentOpenPutPremium = sumBy(
    currentHoldings.options.filter((option) => option.type === "PUT"),
    (option) => option.premiumCollected
  );
  const currentOpenCallPremium = sumBy(
    currentHoldings.options.filter((option) => option.type === "CALL"),
    (option) => option.premiumCollected
  );

  const lifecycleRealizedCapitalGain = sumBy(
    lifecycleEvents,
    (event) => (event.price - event.costBasisPerShare) * event.shares
  );

  const currentEquityUnrealizedPnl = sumBy(currentHoldings.equities, (holding) => holding.unrealizedPnl);
  const currentOptionUnrealizedPnl = sumBy(currentHoldings.options, optionUnrealizedPnl);
  const currentUnrealizedPnl = money(currentEquityUnrealizedPnl + currentOptionUnrealizedPnl);

  const postBaselineCashIncome = sumBy(
    allCashEvents.filter(
      (event) => !event.alreadyInBaseline && (event.eventType === "dividend" || event.eventType === "interest")
    ),
    (event) => event.amount
  );
  const postBaselineCashFees = sumBy(
    allCashEvents.filter((event) => !event.alreadyInBaseline && event.eventType === "fee"),
    (event) => event.amount
  );
  const postBaselineExternalFlows = sumBy(
    allCashEvents.filter(
      (event) =>
        !event.alreadyInBaseline &&
        (event.eventType === "deposit" || event.eventType === "withdrawal" || event.eventType === "transfer_in" || event.eventType === "transfer_out")
    ),
    (event) => event.amount
  );
  const postBaselineReinvestments = sumBy(
    allCashEvents.filter((event) => !event.alreadyInBaseline && event.eventType === "reinvestment"),
    (event) => event.amount
  );
  const postBaselineOtherCashActivity = sumBy(
    allCashEvents.filter(
      (event) =>
        !event.alreadyInBaseline &&
        !["dividend", "interest", "fee", "deposit", "withdrawal", "transfer_in", "transfer_out", "reinvestment"].includes(event.eventType)
    ),
    (event) => event.amount
  );
  const reconciliationCoveredCallPremium = sumBy(
    reconciliationCoveredCalls,
    (call) => call.premiumPerContract * call.contracts * 100
  );
  const statementPremiumGross = sumBy(
    premiumEvents,
    (event) => event.quotedPremiumPerShare * event.contracts * 100
  );
  const statementPremiumNetSettlement = sumBy(premiumEvents, (event) => event.statementAmount);
  const statementPremiumFees = sumBy(
    premiumEvents,
    (event) => event.feeAmount ?? event.statementAmount - event.quotedPremiumPerShare * event.contracts * 100
  );
  const redundantCashEventsTotal = sumBy(
    allCashEvents.filter((event) => event.alreadyInBaseline),
    (event) => event.amount
  );

  const cumulativePremiumToDate = premiumEvents.length > 0
    ? money(baseline.cumulativePremium + statementPremiumGross)
    : money(baseline.cumulativePremium + postBaselineOpenPremium);
  const realizedPremiumToDate = money(cumulativePremiumToDate - currentOpenPremium);
  const realizedCapitalGainToDate = money(baseline.realizedCapitalGain + lifecycleRealizedCapitalGain);
  const totalRealizedPnl = money(realizedPremiumToDate + realizedCapitalGainToDate);
  const currentAum = money(currentCashBalance + currentEquityMarketValue + currentOptionLiability);

  return {
    baselineAsOfDate: baseline.asOfDate,
    currentAsOfDate: currentHoldings.asOfDate,
    currentAum,
    currentCashBalance,
    currentEquityMarketValue,
    currentOptionLiability,
    currentOpenPremium,
    postBaselineOpenPremium,
    currentOpenPutPremium,
    currentOpenCallPremium,
    cumulativePremiumToDate,
    realizedPremiumToDate,
    realizedCapitalGainToDate,
    lifecycleRealizedCapitalGain,
    totalRealizedPnl,
    currentEquityUnrealizedPnl,
    currentOptionUnrealizedPnl,
    currentUnrealizedPnl,
    totalStrategyPnl: money(totalRealizedPnl + currentUnrealizedPnl),
    postBaselineCashIncome,
    postBaselineCashFees,
    postBaselineExternalFlows,
    postBaselineReinvestments,
    postBaselineOtherCashActivity,
    reconciliationCoveredCallPremium,
    statementPremiumGross,
    statementPremiumNetSettlement,
    statementPremiumFees,
    redundantCashEventsTotal,
  };
}
