import { describe, expect, it } from 'vitest';
import { buildOrderIngestionKey } from './orderIngestion';

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
});
