import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ============= Mock Data Factories =============

export const createMockPosition = (overrides = {}) => ({
  id: 'pos-1',
  user_id: 'test-user-id',
  symbol: 'AAPL',
  underlying_name: 'Apple Inc.',
  strike_price: 150,
  expiration: '2024-03-15',
  contracts: 1,
  premium_per_contract: 2.50,
  is_active: true,
  opened_at: '2024-01-01T00:00:00Z',
  closed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  open_fees: 0,
  broker: null,
  raw_order_text: null,
  source: 'INVESTOR_MANUAL',
  allocation_id: null,
  ...overrides,
});

export const createMockAssignedPosition = (overrides = {}) => ({
  id: 'assigned-1',
  user_id: 'test-user-id',
  symbol: 'AAPL',
  shares: 100,
  assignment_date: '2024-02-01',
  assignment_price: 145,
  original_put_premium: 250,
  original_position_id: 'pos-1',
  cost_basis: 142.50,
  is_active: true,
  sold_price: null,
  closed_at: null,
  created_at: '2024-02-01T00:00:00Z',
  updated_at: '2024-02-01T00:00:00Z',
  ...overrides,
});

export const createMockCoveredCall = (overrides = {}) => ({
  id: 'call-1',
  assigned_position_id: 'assigned-1',
  strike_price: 155,
  expiration: '2024-03-15',
  premium_per_contract: 1.50,
  contracts: 1,
  opened_at: '2024-02-15T00:00:00Z',
  closed_at: null,
  is_active: true,
  created_at: '2024-02-15T00:00:00Z',
  updated_at: '2024-02-15T00:00:00Z',
  ...overrides,
});

export const createMockMarketData = (overrides = {}) => ({
  id: 'market-1',
  symbol: 'AAPL',
  underlying_price: 155.50,
  day_open: 154.00,
  day_change_pct: 0.97,
  intraday_prices: [154, 154.5, 155, 155.5],
  last_updated: '2024-01-15T12:00:00Z',
  ...overrides,
});

export const createMockLearningPosition = (overrides = {}) => ({
  id: 'learn-pos-1',
  user_id: 'test-user-id',
  symbol: 'AAPL',
  strike_price: 150,
  expiration: '2024-03-15',
  contracts: 1,
  premium_per_contract: 2.50,
  is_active: true,
  opened_at: '2024-01-01T00:00:00Z',
  closed_at: null,
  notes: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockLearningAssignedPosition = (overrides = {}) => ({
  id: 'learn-assigned-1',
  user_id: 'test-user-id',
  symbol: 'AAPL',
  shares: 100,
  assignment_date: '2024-02-01T00:00:00Z',
  assignment_price: 145,
  original_put_premium: 250,
  original_learning_position_id: 'learn-pos-1',
  cost_basis: 142.50,
  is_active: true,
  sold_price: null,
  closed_at: null,
  created_at: '2024-02-01T00:00:00Z',
  updated_at: '2024-02-01T00:00:00Z',
  ...overrides,
});

// ============= Supabase Query Chain Mock Builder =============

type QueryResult<T> = { data: T | null; error: null } | { data: null; error: Error };

export function createSupabaseQueryChainMock<T>(result: QueryResult<T>) {
  const chainMock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve(result)),
  };

  // Make all terminal methods return a promise with the result
  ['select', 'insert', 'update', 'delete', 'order', 'limit', 'eq', 'neq', 'in', 'not', 'is', 'single', 'maybeSingle'].forEach(method => {
    const originalMock = chainMock[method as keyof typeof chainMock];
    if (typeof originalMock === 'function') {
      (chainMock[method as keyof typeof chainMock] as ReturnType<typeof vi.fn>).mockImplementation(() => {
        return {
          ...chainMock,
          then: (resolve: (value: QueryResult<T>) => void) => Promise.resolve(result).then(resolve),
        };
      });
    }
  });

  return chainMock;
}

// ============= Multi-Table Supabase Mock =============

export function createMultiTableSupabaseMock(tableResults: Record<string, QueryResult<unknown>>) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
    from: vi.fn((tableName: string) => {
      const result = tableResults[tableName] || { data: null, error: null };
      return createSupabaseQueryChainMock(result);
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { totalPremium: 250, contractValue: 100, unrealizedPnL: 50, daysToExp: 30, pctAboveStrike: 3.5, probAssignment: 15, statusBand: 'success' }, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  };
}

// ============= React Query Wrapper =============

export function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============= Toast Mock =============

export const createToastMock = () => {
  const toastFn = vi.fn();
  return {
    toast: toastFn,
    getToastCalls: () => toastFn.mock.calls,
    getLastToastCall: () => toastFn.mock.calls[toastFn.mock.calls.length - 1]?.[0],
  };
};

// ============= Wait Utilities =============

export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
