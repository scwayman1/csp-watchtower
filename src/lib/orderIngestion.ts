export type ParsedTrade = {
  symbol: string;
  strike_price: number;
  expiration: string;
  contracts: number;
  premium_per_contract: number;
  execution_id?: string | null;
  transaction_id?: string | null;
  order_id?: string | null;
};

const EXECUTION_ID_FIELDS = ['execution_id', 'executionId', 'fill_id', 'fillId', 'transaction_id', 'transactionId'];
const ORDER_ID_FIELDS = ['order_id', 'orderId'];

function normalizeSourceText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function hash(value: string): string {
  // Keep broker text out of the database key while retaining a deterministic
  // per-import identity. FNV-1a 64 is sufficient here because the source row
  // and canonical trade fields are also included in the hashed input.
  let result = 14695981039346656037n;
  for (const character of value) {
    result ^= BigInt(character.codePointAt(0) ?? 0);
    result = (result * 1099511628211n) & 0xffffffffffffffffn;
  }
  return result.toString(16).padStart(16, '0');
}

/**
 * Stable identity for one row in one pasted/imported order.
 * The row number is intentional: two identical trades in one statement are
 * distinct rows, while replaying the same statement produces the same keys.
 * When a broker execution/transaction ID is unavailable, a separate import
 * with identical economics remains intentionally distinct rather than being
 * silently merged.
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

  const executionId = EXECUTION_ID_FIELDS
    .map((field) => trade[field])
    .find((value) => typeof value === 'string' && value.trim());
  const orderId = ORDER_ID_FIELDS
    .map((field) => trade[field])
    .find((value) => typeof value === 'string' && value.trim());

  // Prefer the broker's execution/fill/transaction identity. An order ID can
  // cover multiple fills, so it remains scoped to the row economics and
  // occurrence index unless a fill-level identity is available.
  const identity = executionId
    ? `execution:${String(executionId).trim().toLowerCase()}`
    : orderId
      ? `order:${String(orderId).trim().toLowerCase()}|row:${rowIndex}|trade:${normalized}`
      : `source:${normalizeSourceText(rawOrderText)}|row:${rowIndex}|trade:${normalized}`;

  return `${kind}:${hash(identity)}`;
}

export function hasBrokerExecutionIdentity(trade: Record<string, unknown>): boolean {
  return EXECUTION_ID_FIELDS.some((field) => {
    const value = trade[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}
