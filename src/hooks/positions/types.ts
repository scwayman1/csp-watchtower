export interface Position {
  id: string;
  symbol: string;
  underlyingName: string;
  strikePrice: number;
  underlyingPrice: number;
  expiration: string;
  contracts: number;
  premiumPerContract: number;
  totalPremium: number;
  contractValue: number;
  unrealizedPnL: number;
  daysToExp: number;
  pctAboveStrike: number;
  probAssignment: number;
  statusBand: "success" | "warning" | "destructive";
  dayChangePct?: number;
  intradayPrices?: number[];
}
