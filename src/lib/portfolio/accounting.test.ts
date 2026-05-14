import { describe, expect, it } from "vitest";
import {
  calculatePremiumBreakdown,
  calculatePortfolioAccounting,
  classifyCoveredCallExpiration,
  classifyPutExpiration,
} from "./accounting";

describe("canonical portfolio accounting", () => {
  it("counts each option premium in contract dollars exactly once", () => {
    const result = calculatePremiumBreakdown({
      asOfDate: "2026-05-13",
      positions: [
        {
          id: "open-put",
          symbol: "AAPL",
          premiumPerContract: 2.5,
          contracts: 2,
          expiration: "2026-06-19",
          isActive: true,
        },
        {
          id: "expired-put",
          symbol: "MSFT",
          premiumPerContract: 1.2,
          contracts: 1,
          expiration: "2026-01-19",
          isActive: false,
        },
        {
          id: "assigned-source",
          symbol: "TSLA",
          premiumPerContract: 4,
          contracts: 1,
          expiration: "2026-01-19",
          isActive: false,
        },
      ],
      assignedPositions: [
        {
          id: "assigned-row",
          symbol: "TSLA",
          shares: 100,
          originalPutPremium: 400,
          originalPositionId: "assigned-source",
          assignmentDate: "2026-01-19",
          assignmentPrice: 200,
          costBasis: 196,
          isActive: true,
        },
      ],
      coveredCalls: [
        {
          id: "active-call",
          assignedPositionId: "assigned-row",
          symbol: "TSLA",
          premiumPerContract: 1.5,
          contracts: 1,
          expiration: "2026-06-19",
          openedAt: "2026-05-01",
          isActive: true,
        },
        {
          id: "closed-call",
          assignedPositionId: "assigned-row",
          symbol: "TSLA",
          premiumPerContract: 0.75,
          contracts: 2,
          expiration: "2026-04-19",
          openedAt: "2026-03-01",
          isActive: false,
        },
      ],
    });

    expect(result.activePutPremium).toBe(500);
    expect(result.expiredPutPremium).toBe(120);
    expect(result.assignedPutPremium).toBe(400);
    expect(result.activeCallPremium).toBe(150);
    expect(result.closedCallPremium).toBe(150);
    expect(result.totalPremium).toBe(1320);
  });

  it("does not double-count broker account value by adding premiums and gains on top", () => {
    const result = calculatePortfolioAccounting({
      cashBalance: 100_000,
      otherHoldingsValue: 50_000,
      brokerAccountValue: 200_000,
      activePutRequirement: 30_000,
      activePutMarkValue: 800,
      assignedShareMarketValue: 25_000,
      assignedShareCostBasis: 20_000,
      realizedCapitalGains: 3_000,
      totalPremiumsCollected: 4_000,
      activeOptionUnrealizedPnl: 500,
    });

    expect(result.portfolioValue).toBe(200_000);
    expect(result.availableCash).toBe(70_000);
    expect(result.performance.totalPremiumsCollected).toBe(4_000);
    expect(result.performance.realizedCapitalGains).toBe(3_000);
    expect(result.performance.unrealizedAssignedSharePnl).toBe(5_000);
  });

  it("derives AUM from explicit assets when no broker account value is present", () => {
    const result = calculatePortfolioAccounting({
      cashBalance: 100_000,
      otherHoldingsValue: 50_000,
      assignedShareMarketValue: 25_000,
      activePutRequirement: 30_000,
      activePutMarkValue: 800,
      assignedShareCostBasis: 20_000,
      realizedCapitalGains: 3_000,
      totalPremiumsCollected: 4_000,
      activeOptionUnrealizedPnl: 500,
    });

    expect(result.portfolioValue).toBe(174_200);
    expect(result.availableCash).toBe(70_000);
    expect(result.assignedShareMarketValue).toBe(25_000);
  });

  it("recognizes capital gains on assigned equities independently from option premiums", () => {
    const result = calculatePortfolioAccounting({
      cashBalance: 10_000,
      otherHoldingsValue: 0,
      assignedShareMarketValue: 0,
      assignedShareCostBasis: 0,
      activePutRequirement: 0,
      activePutMarkValue: 0,
      totalPremiumsCollected: 750,
      realizedCapitalGains: 1_250,
      activeOptionUnrealizedPnl: 0,
    });

    expect(result.performance.totalPremiumsCollected).toBe(750);
    expect(result.performance.realizedCapitalGains).toBe(1_250);
    expect(result.performance.totalRealizedIncome).toBe(2_000);
  });

  it("classifies expired puts deterministically from expiration-close price", () => {
    expect(
      classifyPutExpiration({ strikePrice: 50, expirationClosePrice: 49.99 })
    ).toEqual({ outcome: "assigned" });

    expect(
      classifyPutExpiration({ strikePrice: 50, expirationClosePrice: 50 })
    ).toEqual({ outcome: "expired_worthless" });
  });

  it("does not force old covered calls into repeated called-away prompts without expiration-close evidence", () => {
    expect(
      classifyCoveredCallExpiration({
        strikePrice: 110,
        expirationClosePrice: undefined,
        currentPrice: 125,
        expiration: "2026-01-19",
        asOfDate: "2026-05-13",
      })
    ).toEqual({ outcome: "needs_reconciliation" });

    expect(
      classifyCoveredCallExpiration({
        strikePrice: 110,
        expirationClosePrice: 111,
        currentPrice: 90,
        expiration: "2026-01-19",
        asOfDate: "2026-05-13",
      })
    ).toEqual({ outcome: "called_away" });
  });
});
