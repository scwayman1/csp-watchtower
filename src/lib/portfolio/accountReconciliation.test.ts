import { describe, expect, it } from "vitest";
import { buildAccountReconciliationSummary } from "./accountReconciliation";

const apr30Baseline = {
  asOfDate: "2026-04-30",
  brokerAccountValue: 717039.63,
  cashBalance: 122934.71,
  cumulativePremium: 58337,
  realizedPremium: 47073.79,
  realizedCapitalGain: 3471,
  openPremium: 11263.21,
  optionLiability: -43679,
};

const currentHoldings = {
  asOfDate: "2026-05-13",
  cashBalance: 530530.49,
  equities: [
    { symbol: "META", shares: 200.176, marketValue: 123434.52, unrealizedPnl: -9142.53 },
    { symbol: "INTU", shares: 100.299, marketValue: 37282.14, unrealizedPnl: -21717.88 },
    { symbol: "CRM", shares: 200.464, marketValue: 33244.94, unrealizedPnl: -15283.11 },
  ],
  options: [
    { symbol: "CRM", type: "CALL" as const, contracts: 2, premiumCollected: 437.95, marketValue: -4, unrealizedPnl: 433.95 },
    { symbol: "UBER", type: "PUT" as const, contracts: 1, premiumCollected: 100.98, marketValue: -51, unrealizedPnl: 49.98 },
    { symbol: "AMD", type: "PUT" as const, contracts: 1, premiumCollected: 739.96, marketValue: -71, unrealizedPnl: 668.96 },
    { symbol: "NVDA", type: "PUT" as const, contracts: 2, premiumCollected: 407.95, marketValue: -82, unrealizedPnl: 325.95 },
    { symbol: "WMT", type: "PUT" as const, contracts: 1, premiumCollected: 149.98, marketValue: -139, unrealizedPnl: 10.98 },
    { symbol: "GOOG", type: "PUT" as const, contracts: 1, premiumCollected: 417.98, marketValue: -147, unrealizedPnl: 270.98 },
    { symbol: "QQQ", type: "PUT" as const, contracts: 1, premiumCollected: 674.96, marketValue: -149, unrealizedPnl: 525.96 },
    { symbol: "INTU", type: "CALL" as const, contracts: 1, premiumCollected: 937.96, marketValue: -200, unrealizedPnl: 737.96 },
    { symbol: "DIA", type: "PUT" as const, contracts: 1, premiumCollected: 499.96, marketValue: -275, unrealizedPnl: 224.96 },
    { symbol: "GOOGL", type: "PUT" as const, contracts: 2, premiumCollected: 985.92, marketValue: -312, unrealizedPnl: 673.92 },
    { symbol: "TSM", type: "PUT" as const, contracts: 1, premiumCollected: 420.98, marketValue: -315, unrealizedPnl: 105.98 },
    { symbol: "CRWD", type: "PUT" as const, contracts: 2, premiumCollected: 1391.92, marketValue: -320, unrealizedPnl: 1071.92 },
    { symbol: "AMZN", type: "PUT" as const, contracts: 2, premiumCollected: 725.93, marketValue: -590, unrealizedPnl: 135.93 },
    { symbol: "MSFT", type: "PUT" as const, contracts: 1, premiumCollected: 507.96, marketValue: -750, unrealizedPnl: -242.04 },
    { symbol: "META", type: "CALL" as const, contracts: 2, premiumCollected: 1524.91, marketValue: -1590, unrealizedPnl: -65.09 },
  ],
};

describe("buildAccountReconciliationSummary", () => {
  it("rolls a statement baseline forward with current vintage without double-counting open premiums", () => {
    const summary = buildAccountReconciliationSummary({
      baseline: apr30Baseline,
      currentHoldings,
      lifecycleEvents: [
        { symbol: "DDOG", eventType: "called_away", shares: 200, price: 135, costBasisPerShare: 167.7 },
        { symbol: "QQQ", eventType: "called_away", shares: 100, price: 601, costBasisPerShare: 600.77 },
        { symbol: "CRWD", eventType: "called_away", shares: 200, price: 410, costBasisPerShare: 403.93 },
        { symbol: "AMZN", eventType: "called_away", shares: 200, price: 230, costBasisPerShare: 236.75 },
        { symbol: "GOOGL", eventType: "called_away", shares: 100, price: 310, costBasisPerShare: 310.76 },
        { symbol: "GOOG", eventType: "called_away", shares: 200, price: 320, costBasisPerShare: 311.05 },
        { symbol: "MSFT", eventType: "called_away", shares: 100, price: 400, costBasisPerShare: 444.38 },
        { symbol: "DIA", eventType: "called_away", shares: 100, price: 473, costBasisPerShare: 469.19 },
        { symbol: "GOOGL", eventType: "stock_sale", shares: 0.069, price: 388.12, costBasisPerShare: 310.76 },
        { symbol: "GOOG", eventType: "stock_sale", shares: 0.138, price: 384.35, costBasisPerShare: 311.05 },
        { symbol: "MSFT", eventType: "stock_sale", shares: 0.225, price: 410.8, costBasisPerShare: 444.38 },
        { symbol: "QQQ", eventType: "stock_sale", shares: 0.126, price: 681.11, costBasisPerShare: 600.77 },
      ],
      cashEvents: [
        { eventType: "dividend", amount: 20.62, eventDate: "2026-05-11", alreadyInBaseline: false },
        { eventType: "dividend", amount: 347.37, eventDate: "2026-04-30", alreadyInBaseline: true },
      ],
    });

    expect(summary.currentAum).toBe(719497.09);
    expect(summary.currentOptionLiability).toBe(-4995);
    expect(summary.currentOpenPremium).toBe(9925.3);
    expect(summary.cumulativePremiumToDate).toBe(68262.3);
    expect(summary.realizedPremiumToDate).toBe(58337);
    expect(summary.realizedCapitalGainToDate).toBe(-5506.98);
    expect(summary.totalRealizedPnl).toBe(52830.02);
    expect(summary.currentUnrealizedPnl).toBe(-41213.22);
    expect(summary.totalStrategyPnl).toBe(11616.8);
    expect(summary.postBaselineCashIncome).toBe(20.62);
  });

  it("flags stale statement cash events as redundant instead of adding them again", () => {
    const summary = buildAccountReconciliationSummary({
      baseline: apr30Baseline,
      currentHoldings,
      lifecycleEvents: [],
      cashEvents: [
        { eventType: "dividend", amount: 347.37, eventDate: "2026-04-30", alreadyInBaseline: true },
        { eventType: "dividend", amount: 88, eventDate: "2026-04-23", alreadyInBaseline: true },
      ],
    });

    expect(summary.postBaselineCashIncome).toBe(0);
    expect(summary.redundantCashEventsTotal).toBe(435.37);
  });
});
