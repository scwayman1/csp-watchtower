export type ParsedTrade = {
  symbol: string;
  strike_price: number;
  expiration: string;
  contracts: number;
  premium_per_contract: number;
};

/**
 * Stable identity for one row in one pasted/imported order.
 * The row number is intentional: two identical trades in one statement are
 * distinct rows, while replaying the same statement produces the same keys.
 */
export function buildOrderIngestionKey(
  rawOrderText: string,
  kind: 'put' | 'call' | 'share',
  rowIndex: number,
  trade: Record<string, unknown>,
): string {
  const normalized = Object.keys(trade)
    .sort()
    .map((key) => `${key}=${String(trade[key])}`)
    .join('&');

  return `${kind}:${rowIndex}:${normalized}:${rawOrderText}`;
}
