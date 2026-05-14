import { classifyCoveredCallExpiration, classifyPutExpiration } from "./accounting";

export type ReconciliationEventType =
  | "put_assigned"
  | "put_expired_worthless"
  | "call_called_away"
  | "call_expired_worthless"
  | "needs_reconciliation";

export type ReconciliationConfidence = "high" | "medium" | "needs_statement";

export interface ReconciliationEvent {
  id: string;
  eventType: ReconciliationEventType;
  sourceTable: "positions" | "covered_calls";
  sourceId: string;
  symbol: string;
  eventDate: string;
  confidence: ReconciliationConfidence;
  estimatedValueImpact: number;
  realizedCapitalGain?: number;
  metadata: Record<string, string | number | boolean | null>;
}

export interface ReconcilePutInput {
  id: string;
  symbol: string;
  expiration: string;
  strikePrice: number;
  contracts: number;
  premiumPerContract: number;
  currentPrice?: number | null;
  expirationClosePrice?: number | null;
  isActive: boolean;
  alreadyAssigned?: boolean;
}

export interface ReconcileCoveredCallInput {
  id: string;
  assignedPositionId: string;
  symbol: string;
  expiration: string;
  strikePrice: number;
  contracts: number;
  premiumPerContract: number;
  costBasis: number;
  sharesHeld: number;
  currentPrice?: number | null;
  expirationClosePrice?: number | null;
  isActive: boolean;
  closedAt?: string | null;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function isExpired(expiration: string, asOfDate: string): boolean {
  return dateOnly(expiration) < dateOnly(asOfDate);
}

function optionPremium(premiumPerContract: number, contracts: number): number {
  return Math.round((premiumPerContract || 0) * (contracts || 0) * 100 * 100) / 100;
}

export function buildPutReconciliationEvents({
  positions,
  asOfDate,
}: {
  positions: ReconcilePutInput[];
  asOfDate: string;
}): ReconciliationEvent[] {
  const events: ReconciliationEvent[] = [];

  for (const position of positions) {
    if (!position.isActive || position.alreadyAssigned || !isExpired(position.expiration, asOfDate)) {
      continue;
    }

    const shares = position.contracts * 100;
    const premium = optionPremium(position.premiumPerContract, position.contracts);
    const classification = classifyPutExpiration({
      strikePrice: position.strikePrice,
      expirationClosePrice: position.expirationClosePrice,
    });

    if (classification.outcome === "needs_reconciliation") {
      events.push({
        id: `positions:${position.id}:needs_reconciliation`,
        eventType: "needs_reconciliation",
        sourceTable: "positions",
        sourceId: position.id,
        symbol: position.symbol,
        eventDate: position.expiration,
        confidence: "needs_statement",
        estimatedValueImpact: 0,
        metadata: {
          reason: "missing_expiration_close_price",
          strikePrice: position.strikePrice,
          contracts: position.contracts,
          currentPrice: position.currentPrice ?? null,
        },
      });
      continue;
    }

    if (classification.outcome === "assigned") {
      const assignmentCost = position.strikePrice * shares;
      events.push({
        id: `positions:${position.id}:put_assigned`,
        eventType: "put_assigned",
        sourceTable: "positions",
        sourceId: position.id,
        symbol: position.symbol,
        eventDate: position.expiration,
        confidence: "high",
        estimatedValueImpact: -assignmentCost,
        metadata: {
          strikePrice: position.strikePrice,
          shares,
          assignmentCost,
          originalPutPremium: premium,
          costBasis: position.strikePrice - premium / shares,
        },
      });
    } else {
      events.push({
        id: `positions:${position.id}:put_expired_worthless`,
        eventType: "put_expired_worthless",
        sourceTable: "positions",
        sourceId: position.id,
        symbol: position.symbol,
        eventDate: position.expiration,
        confidence: "high",
        estimatedValueImpact: premium,
        metadata: {
          strikePrice: position.strikePrice,
          contracts: position.contracts,
          premiumKept: premium,
        },
      });
    }
  }

  return events;
}

export function buildCoveredCallReconciliationEvents({
  coveredCalls,
  asOfDate,
}: {
  coveredCalls: ReconcileCoveredCallInput[];
  asOfDate: string;
}): ReconciliationEvent[] {
  const events: ReconciliationEvent[] = [];

  for (const call of coveredCalls) {
    if (!call.isActive || call.closedAt || !isExpired(call.expiration, asOfDate)) {
      continue;
    }

    const sharesCalledAway = Math.min(call.contracts * 100, call.sharesHeld);
    const callPremium = optionPremium(call.premiumPerContract, call.contracts);
    const classification = classifyCoveredCallExpiration({
      strikePrice: call.strikePrice,
      expirationClosePrice: call.expirationClosePrice,
      currentPrice: call.currentPrice,
      expiration: call.expiration,
      asOfDate,
    });

    if (classification.outcome === "needs_reconciliation") {
      events.push({
        id: `covered_calls:${call.id}:needs_reconciliation`,
        eventType: "needs_reconciliation",
        sourceTable: "covered_calls",
        sourceId: call.id,
        symbol: call.symbol,
        eventDate: call.expiration,
        confidence: "needs_statement",
        estimatedValueImpact: 0,
        metadata: {
          reason: "missing_expiration_close_price",
          strikePrice: call.strikePrice,
          contracts: call.contracts,
          currentPrice: call.currentPrice ?? null,
          assignedPositionId: call.assignedPositionId,
        },
      });
      continue;
    }

    if (classification.outcome === "called_away") {
      const realizedCapitalGain = (call.strikePrice - call.costBasis) * sharesCalledAway;
      events.push({
        id: `covered_calls:${call.id}:call_called_away`,
        eventType: "call_called_away",
        sourceTable: "covered_calls",
        sourceId: call.id,
        symbol: call.symbol,
        eventDate: call.expiration,
        confidence: "high",
        estimatedValueImpact: call.strikePrice * sharesCalledAway,
        realizedCapitalGain,
        metadata: {
          assignedPositionId: call.assignedPositionId,
          strikePrice: call.strikePrice,
          sharesCalledAway,
          callPremium,
          costBasis: call.costBasis,
        },
      });
    } else {
      events.push({
        id: `covered_calls:${call.id}:call_expired_worthless`,
        eventType: "call_expired_worthless",
        sourceTable: "covered_calls",
        sourceId: call.id,
        symbol: call.symbol,
        eventDate: call.expiration,
        confidence: "high",
        estimatedValueImpact: callPremium,
        metadata: {
          assignedPositionId: call.assignedPositionId,
          strikePrice: call.strikePrice,
          contracts: call.contracts,
          premiumKept: callPremium,
        },
      });
    }
  }

  return events;
}

export function buildPortfolioReconciliationEvents({
  positions,
  coveredCalls,
  asOfDate,
}: {
  positions: ReconcilePutInput[];
  coveredCalls: ReconcileCoveredCallInput[];
  asOfDate: string;
}): ReconciliationEvent[] {
  return [
    ...buildPutReconciliationEvents({ positions, asOfDate }),
    ...buildCoveredCallReconciliationEvents({ coveredCalls, asOfDate }),
  ].sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.symbol.localeCompare(b.symbol));
}
