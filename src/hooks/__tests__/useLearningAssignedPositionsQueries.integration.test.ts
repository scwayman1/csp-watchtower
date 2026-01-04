import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createMockLearningAssignedPosition,
  createMockCoveredCall,
  createQueryClientWrapper,
  createToastMock,
  flushPromises,
} from './testUtils';

// Mock toast
const { toast } = createToastMock();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

// Mock subscriptions
vi.mock('@/hooks/learning/useLearningAssignedPositionsSubscriptions', () => ({
  useLearningAssignedPositionsSubscriptions: vi.fn(),
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

// Import after mocks
import { useLearningAssignedPositionsQueries } from '../learning/useLearningAssignedPositionsQueries';

// Helper to setup mock chain for assigned positions (with covered_calls join)
const setupMockChain = (activeData: unknown, closedData: unknown = [], error: Error | null = null) => {
  let callCount = 0;
  const chainMock = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(() => {
      callCount++;
      // First call is for active, second for closed
      const data = callCount === 1 ? activeData : closedData;
      return Promise.resolve({ data, error });
    }),
  };
  mockSupabase.from.mockReturnValue(chainMock);
  return chainMock;
};

describe('useLearningAssignedPositionsQueries Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Active Positions Fetching', () => {
    it('should fetch active assigned positions for a user', async () => {
      const mockPositions = [
        createMockLearningAssignedPosition({ id: 'lap-1', symbol: 'AAPL', is_active: true }),
        createMockLearningAssignedPosition({ id: 'lap-2', symbol: 'GOOGL', is_active: true }),
      ];

      setupMockChain(mockPositions, []);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_assigned_positions');
      expect(result.current.assignedPositions).toHaveLength(2);
      expect(result.current.assignedPositions[0].symbol).toBe('AAPL');
    });

    it('should fetch positions with covered calls included', async () => {
      const mockCoveredCall = createMockCoveredCall({
        id: 'lcc-1',
        strike_price: 160,
        premium_per_contract: 2.00,
      });

      const mockPosition = {
        ...createMockLearningAssignedPosition({ id: 'lap-1', symbol: 'AAPL' }),
        covered_calls: [mockCoveredCall],
      };

      setupMockChain([mockPosition], []);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.assignedPositions).toHaveLength(1);
      const position = result.current.assignedPositions[0];
      expect(position.covered_calls).toHaveLength(1);
      expect(position.covered_calls[0].strike_price).toBe(160);
    });

    it('should return empty array when no positions exist', async () => {
      setupMockChain([], []);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.assignedPositions).toEqual([]);
      expect(result.current.closedPositions).toEqual([]);
    });
  });

  describe('Closed Positions Fetching', () => {
    it('should fetch closed positions separately', async () => {
      const closedPosition = createMockLearningAssignedPosition({
        id: 'lap-closed-1',
        symbol: 'TSLA',
        is_active: false,
        sold_price: 155,
        closed_at: '2024-02-15T00:00:00Z',
      });

      setupMockChain([], [closedPosition]);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.closedPositions).toHaveLength(1);
      expect(result.current.closedPositions[0].symbol).toBe('TSLA');
    });
  });

  describe('Query Behavior Without UserId', () => {
    it('should not fetch when userId is undefined', async () => {
      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries(undefined),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.assignedPositions).toEqual([]);
      expect(result.current.closedPositions).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      setupMockChain(null, null, new Error('Database error'));

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.assignedPositions).toEqual([]);
    });

    it('should handle null data response', async () => {
      setupMockChain(null, null);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.assignedPositions).toEqual([]);
      expect(result.current.closedPositions).toEqual([]);
    });
  });

  describe('Position Data Structure', () => {
    it('should return positions with all required fields', async () => {
      const mockPosition = createMockLearningAssignedPosition({
        id: 'lap-1',
        symbol: 'AAPL',
        shares: 100,
        assignment_price: 148,
        assignment_date: '2024-02-01T00:00:00Z',
        cost_basis: 145.50,
        original_put_premium: 250,
        is_active: true,
      });

      setupMockChain([mockPosition], []);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.assignedPositions).toHaveLength(1);

      const position = result.current.assignedPositions[0];
      expect(position.id).toBe('lap-1');
      expect(position.symbol).toBe('AAPL');
      expect(position.shares).toBe(100);
      expect(position.assignment_price).toBe(148);
      expect(position.cost_basis).toBe(145.50);
      expect(position.original_put_premium).toBe(250);
      expect(position.is_active).toBe(true);
    });

    it('should include covered calls in the response', async () => {
      const mockCoveredCalls = [
        createMockCoveredCall({ id: 'lcc-1', strike_price: 155, is_active: true }),
        createMockCoveredCall({ id: 'lcc-2', strike_price: 160, is_active: false }),
      ];

      const mockPosition = {
        ...createMockLearningAssignedPosition({ id: 'lap-1' }),
        covered_calls: mockCoveredCalls,
      };

      setupMockChain([mockPosition], []);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.assignedPositions).toHaveLength(1);
      expect(result.current.assignedPositions[0].covered_calls).toHaveLength(2);
    });
  });

  describe('PnL Calculation Data', () => {
    it('should include sold_price for closed positions', async () => {
      const closedPosition = createMockLearningAssignedPosition({
        id: 'lap-closed',
        symbol: 'AAPL',
        is_active: false,
        assignment_price: 145,
        sold_price: 160,
        closed_at: '2024-03-01T00:00:00Z',
      });

      setupMockChain([], [closedPosition]);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.closedPositions).toHaveLength(1);
      expect(result.current.closedPositions[0].sold_price).toBe(160);
    });
  });

  describe('Multiple Positions Handling', () => {
    it('should handle multiple positions with different states', async () => {
      const positions = [
        createMockLearningAssignedPosition({ id: 'lap-1', symbol: 'AAPL', is_active: true }),
        createMockLearningAssignedPosition({ id: 'lap-2', symbol: 'GOOGL', is_active: true }),
        createMockLearningAssignedPosition({ id: 'lap-3', symbol: 'MSFT', is_active: true }),
      ];

      setupMockChain(positions, []);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningAssignedPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.assignedPositions).toHaveLength(3);

      const symbols = result.current.assignedPositions.map(p => p.symbol);
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('GOOGL');
      expect(symbols).toContain('MSFT');
    });
  });
});
