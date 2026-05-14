import { describe, expect, it } from "vitest";
import {
  buildCoveredCallReconciliationEvents,
  buildPortfolioReconciliationEvents,
  buildPutReconciliationEvents,
} from "./reconciliation";

describe("portfolio lifecycle reconciliation", () => {
  it("predicts put assignment from expiration-close evidence and includes asset/cash impact", () => {
    const events = buildPutReconciliationEvents({
      asOfDate: "2026-05-13",
      positions: [
        {
          id: "put-1",
          symbol: "AAPL",
          expiration: "2026-05-10",
          strikePrice: 100,
          contracts: 2,
          premiumPerContract: 1.25,
          expirationClosePrice: 99.5,
          isActive: true,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "put_assigned",
      sourceTable: "positions",
      sourceId: "put-1",
      confidence: "high",
      estimatedValueImpact: -20_000,
      metadata: {
        shares: 200,
        assignmentCost: 20_000,
        originalPutPremium: 250,
        costBasis: 98.75,
      },
    });
  });

  it("does not silently assign expired puts without expiration-close evidence", () => {
    const events = buildPutReconciliationEvents({
      asOfDate: "2026-05-13",
      positions: [
        {
          id: "put-2",
          symbol: "MSFT",
          expiration: "2026-05-10",
          strikePrice: 300,
          contracts: 1,
          premiumPerContract: 2,
          currentPrice: 250,
          isActive: true,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "needs_reconciliation",
      confidence: "needs_statement",
      metadata: {
        reason: "missing_expiration_close_price",
        currentPrice: 250,
      },
    });
  });

  it("separates covered-call capital gains from call premium income", () => {
    const events = buildCoveredCallReconciliationEvents({
      asOfDate: "2026-05-13",
      coveredCalls: [
        {
          id: "call-1",
          assignedPositionId: "assigned-1",
          symbol: "TSLA",
          expiration: "2026-05-10",
          strikePrice: 225,
          contracts: 1,
          premiumPerContract: 3,
          costBasis: 200,
          sharesHeld: 100,
          expirationClosePrice: 230,
          isActive: true,
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "call_called_away",
      sourceTable: "covered_calls",
      realizedCapitalGain: 2_500,
      estimatedValueImpact: 22_500,
      metadata: {
        callPremium: 300,
        sharesCalledAway: 100,
        costBasis: 200,
      },
    });
  });

  it("emits expired-worthless call events when expiration close is below strike", () => {
    const events = buildCoveredCallReconciliationEvents({
      asOfDate: "2026-05-13",
      coveredCalls: [
        {
          id: "call-2",
          assignedPositionId: "assigned-2",
          symbol: "TSLA",
          expiration: "2026-05-10",
          strikePrice: 225,
          contracts: 1,
          premiumPerContract: 3,
          costBasis: 200,
          sharesHeld: 100,
          expirationClosePrice: 224.99,
          isActive: true,
        },
      ],
    });

    expect(events[0]).toMatchObject({
      eventType: "call_expired_worthless",
      estimatedValueImpact: 300,
      metadata: { premiumKept: 300 },
    });
  });

  it("combines and sorts put and covered-call reconciliation events", () => {
    const events = buildPortfolioReconciliationEvents({
      asOfDate: "2026-05-13",
      positions: [
        {
          id: "put-1",
          symbol: "ZZZ",
          expiration: "2026-05-12",
          strikePrice: 10,
          contracts: 1,
          premiumPerContract: 1,
          expirationClosePrice: 11,
          isActive: true,
        },
      ],
      coveredCalls: [
        {
          id: "call-1",
          assignedPositionId: "assigned-1",
          symbol: "AAA",
          expiration: "2026-05-11",
          strikePrice: 10,
          contracts: 1,
          premiumPerContract: 1,
          costBasis: 9,
          sharesHeld: 100,
          expirationClosePrice: 12,
          isActive: true,
        },
      ],
    });

    expect(events.map((event) => event.symbol)).toEqual(["AAA", "ZZZ"]);
  });
});
