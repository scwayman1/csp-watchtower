export type ReconciliationOptionType = "PUT" | "CALL";
export type ReconciliationLifecycleEventType = "called_away" | "stock_sale" | "assigned" | "expired";
export type ReconciliationCashEventType = "dividend" | "interest" | "deposit" | "withdrawal" | "reinvestment";

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
}

export interface ReconciliationCashEvent {
  eventType: ReconciliationCashEventType;
  amount: number;
  eventDate: string;
  alreadyInBaseline?: boolean;
}

export interface AccountReconciliationSummaryInput {
  baseline: ReconciliationBaseline;
  currentHoldings: ReconciliationCurrentHoldings;
  lifecycleEvents: ReconciliationLifecycleEvent[];
  cashEvents: ReconciliationCashEvent[];
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
}: AccountReconciliationSummaryInput): AccountReconciliationSummary {
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
    cashEvents.filter((event) => !event.alreadyInBaseline),
    (event) => event.amount
  );
  const redundantCashEventsTotal = sumBy(
    cashEvents.filter((event) => event.alreadyInBaseline),
    (event) => event.amount
  );

  const cumulativePremiumToDate = money(baseline.cumulativePremium + postBaselineOpenPremium);
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
    redundantCashEventsTotal,
  };
}
