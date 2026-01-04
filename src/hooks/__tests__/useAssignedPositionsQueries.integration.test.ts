import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createMockAssignedPosition,
  createMockCoveredCall,
  createMockMarketData,
  flushPromises,
} from './testUtils';

// Mock subscriptions
vi.mock('../assigned/useAssignedPositionsSubscriptions', () => ({
  useAssignedPositionsSubscriptions: vi.fn(),
}));

// Create mock with proper typing
const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
  },
  from: vi.fn(),
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

import { useAssignedPositionsQueries } from '../assigned/useAssignedPositionsQueries';
import { toast } from '@/hooks/use-toast';

describe('useAssignedPositionsQueries Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } } });
  });

  describe('Active and Closed Positions Flow', () => {
    it('should fetch both active and closed positions', async () => {
      const activePositions = [
        createMockAssignedPosition({ id: 'active-1', is_active: true }),
      ];
      const closedPositions = [
        createMockAssignedPosition({ 
          id: 'closed-1', 
          is_active: false, 
          sold_price: 160,
          closed_at: '2024-03-01T00:00:00Z' 
        }),
      ];
      const coveredCalls = [
        createMockCoveredCall({ assigned_position_id: 'active-1' }),
        createMockCoveredCall({ id: 'call-2', assigned_position_id: 'closed-1' }),
      ];
      const marketData = [createMockMarketData({ symbol: 'AAPL' })];

      let queryCount = 0;
      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'assigned_positions') {
          queryCount++;
          if (queryCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: activePositions, error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: closedPositions, error: null }),
                }),
              }),
            }),
          };
        }
        if (tableName === 'covered_calls') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: coveredCalls, error: null }),
            }),
          };
        }
        if (tableName === 'market_data') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: marketData, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => useAssignedPositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('assigned_positions');
      expect(mockSupabase.from).toHaveBeenCalledWith('covered_calls');
      expect(mockSupabase.from).toHaveBeenCalledWith('market_data');
    });

    it('should handle empty positions gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }));

      const { result } = renderHook(() => useAssignedPositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(result.current.assignedPositions).toEqual([]);
      expect(result.current.closedPositions).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should show toast on active positions fetch error', async () => {
      const dbError = new Error('Connection timeout');

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
          }),
        }),
      }));

      const { result } = renderHook(() => useAssignedPositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error loading assigned positions',
          variant: 'destructive',
        })
      );
    });

    it('should show toast on closed positions fetch error', async () => {
      const dbError = new Error('Query failed');

      let queryCount = 0;
      mockSupabase.from.mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: null, error: dbError }),
              }),
            }),
          }),
        };
      });

      const { result } = renderHook(() => useAssignedPositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error loading assigned positions',
          variant: 'destructive',
        })
      );
    });
  });

  describe('User Authentication', () => {
    it('should not fetch when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

      const { result } = renderHook(() => useAssignedPositionsQueries(undefined));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(mockSupabase.from).not.toHaveBeenCalledWith('assigned_positions');
    });

    it('should use provided userId over authenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-user' } } });

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }));

      const { result } = renderHook(() => useAssignedPositionsQueries('custom-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('assigned_positions');
    });
  });

  describe('Calculations', () => {
    it('should process active positions with market data', async () => {
      const activePositions = [
        createMockAssignedPosition({
          id: 'pos-1',
          cost_basis: 142.50,
          shares: 100,
        }),
      ];
      const marketData = [
        createMockMarketData({ symbol: 'AAPL', underlying_price: 155.50 }),
      ];

      let queryCount = 0;
      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'assigned_positions') {
          queryCount++;
          if (queryCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: activePositions, error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (tableName === 'covered_calls') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (tableName === 'market_data') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: marketData, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => useAssignedPositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(result.current.loading).toBe(false);
    });

    it('should process closed positions with realized PnL', async () => {
      const closedPositions = [
        createMockAssignedPosition({
          id: 'closed-1',
          is_active: false,
          cost_basis: 142.50,
          shares: 100,
          sold_price: 160,
          closed_at: '2024-03-01T00:00:00Z',
        }),
      ];

      let queryCount = 0;
      mockSupabase.from.mockImplementation((tableName: string) => {
        if (tableName === 'assigned_positions') {
          queryCount++;
          if (queryCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: closedPositions, error: null }),
                }),
              }),
            }),
          };
        }
        if (tableName === 'covered_calls') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const { result } = renderHook(() => useAssignedPositionsQueries('test-user-id'));

      await act(async () => {
        await result.current.refetch();
        await flushPromises();
      });

      expect(result.current.loading).toBe(false);
    });
  });
});
