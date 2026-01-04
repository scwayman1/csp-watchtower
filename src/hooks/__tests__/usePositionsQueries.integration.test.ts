import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createMockPosition,
  createMockMarketData,
  flushPromises,
} from './testUtils';

// Mock subscriptions
vi.mock('../positions/usePositionsSubscriptions', () => ({
  usePositionsSubscriptions: vi.fn(),
}));

// Create mock with proper typing
const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
  },
  from: vi.fn(),
  functions: {
    invoke: vi.fn().mockResolvedValue({ 
      data: { totalPremium: 250, statusBand: 'success' }, 
      error: null 
    }),
  },
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }),
  removeChannel: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

import { usePositionsQueries } from '../positions/usePositionsQueries';
import { toast } from '@/hooks/use-toast';

describe('usePositionsQueries Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } } });
  });

  describe('Data Fetching Flow', () => {
    it('should fetch positions and enrich with market data', async () => {
      const mockPositions = [
        createMockPosition({ id: 'pos-1', symbol: 'AAPL' }),
        createMockPosition({ id: 'pos-2', symbol: 'GOOGL', strike_price: 140 }),
      ];
      const mockMarketData = [
        createMockMarketData({ symbol: 'AAPL', underlying_price: 160 }),
        createMockMarketData({ symbol: 'GOOGL', underlying_price: 145 }),
      ];

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'positions') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockPositions, error: null }),
            }),
          };
        }
        if (tableName === 'market_data') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockMarketData, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => usePositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('positions');
      expect(mockSupabase.from).toHaveBeenCalledWith('market_data');
    });

    it('should handle empty positions response', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }));

      const { result } = renderHook(() => usePositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(result.current.positions).toEqual([]);
    });

    it('should identify shared positions correctly', async () => {
      const mockPositions = [
        createMockPosition({ id: 'pos-1', user_id: 'test-user-id' }),
        createMockPosition({ id: 'pos-2', user_id: 'other-user-id' }),
      ];

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'positions') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockPositions, error: null }),
            }),
          };
        }
        if (tableName === 'market_data') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [createMockMarketData()], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => usePositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(result.current.sharedOwners.has('pos-2')).toBe(true);
      expect(result.current.sharedOwners.get('pos-2')).toBe('other-user-id');
    });
  });

  describe('Error Handling', () => {
    it('should show toast on database error', async () => {
      const dbError = new Error('Database connection failed');

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
        }),
      }));

      const { result } = renderHook(() => usePositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error loading positions',
          variant: 'destructive',
        })
      );
    });

    it('should not fetch when no userId is available', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

      const { result } = renderHook(() => usePositionsQueries(undefined));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(mockSupabase.from).not.toHaveBeenCalledWith('positions');
    });
  });

  describe('Metrics Calculation', () => {
    it('should call calculate-metrics edge function for each position', async () => {
      const mockPositions = [
        createMockPosition({ id: 'pos-1' }),
        createMockPosition({ id: 'pos-2' }),
      ];

      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'positions') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockPositions, error: null }),
            }),
          };
        }
        if (tableName === 'market_data') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [createMockMarketData()], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { totalPremium: 250, statusBand: 'success' },
        error: null,
      });

      const { result } = renderHook(() => usePositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'calculate-metrics',
        expect.objectContaining({
          body: expect.objectContaining({
            userId: 'test-user-id',
          }),
        })
      );
    });
  });
});
