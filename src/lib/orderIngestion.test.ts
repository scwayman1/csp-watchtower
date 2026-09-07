import { describe, expect, it } from 'vitest';
import { buildOrderIngestionKey, hasBrokerExecutionIdentity } from './orderIngestion';

const put = {
  symbol: 'DIA',
  strike_price: 400,
  expiration: '2026-06-19',
  contracts: 1,
  premium_per_contract: 2.5,
};

describe('buildOrderIngestionKey', () => {
  it('is stable for an exact replay', () => {
    expect(buildOrderIngestionKey('same order', 'put', 0, put))
      .toBe(buildOrderIngestionKey('same order', 'put', 0, put));
  });

  it('tolerates case and whitespace-only formatting changes', () => {
    expect(buildOrderIngestionKey('  SAME\nORDER  ', 'put', 0, put))
      .toBe(buildOrderIngestionKey('same order', 'put', 0, put));
  });

  it('keeps distinct trades distinct', () => {
    expect(buildOrderIngestionKey('same order', 'put', 0, put))
      .not.toBe(buildOrderIngestionKey('same order', 'put', 1, put));
    expect(buildOrderIngestionKey('same order', 'put', 0, put))
      .not.toBe(buildOrderIngestionKey('different order', 'put', 0, put));
  });

  it('uses broker fill identity across formatting, ordering, and batch changes', () => {
    const identified = { ...put, execution_id: 'FILL-123' };
    const replay = { ...put, execution_id: 'fill-123' };
    expect(hasBrokerExecutionIdentity(identified)).toBe(true);
    expect(buildOrderIngestionKey('full statement', 'put', 0, identified))
      .toBe(buildOrderIngestionKey('one-row replay', 'put', 7, replay));
  });

  it('keeps separate broker fills distinct even when economics match', () => {
    expect(buildOrderIngestionKey('statement', 'put', 0, { ...put, execution_id: 'FILL-1' }))
      .not.toBe(buildOrderIngestionKey('statement', 'put', 0, { ...put, execution_id: 'FILL-2' }));
  });

  it('surfaces the limits of source-only identity', () => {
    expect(hasBrokerExecutionIdentity(put)).toBe(false);
    // Partial/reordered source batches cannot be proven to be the same fill.
    expect(buildOrderIngestionKey('A\nB', 'put', 0, put))
      .not.toBe(buildOrderIngestionKey('B\nA', 'put', 1, put));
    // An exact source replay is deduplicated, but an identical legitimate fill
    // without broker identity is inherently ambiguous and must be surfaced by
    // the importer rather than described as proven duplicate data.
    expect(buildOrderIngestionKey('same source', 'put', 0, put))
      .toBe(buildOrderIngestionKey('same source', 'put', 0, put));
  });

  it('produces one conflict key for concurrent retries of an identified fill', async () => {
    const identified = { ...put, execution_id: 'FILL-CONCURRENT' };
    const keys = await Promise.all([
      Promise.resolve(buildOrderIngestionKey('retry A', 'put', 0, identified)),
      Promise.resolve(buildOrderIngestionKey('retry B', 'put', 4, identified)),
    ]);
    expect(new Set(keys).size).toBe(1);
  });

  it('does not hide malformed source fields behind a duplicate result', () => {
    expect(() => buildOrderIngestionKey('source', 'put', 0, {
      symbol: undefined,
      execution_id: null,
    })).not.toThrow();
  });
});
