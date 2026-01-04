import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createMockLearningPosition,
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
vi.mock('@/hooks/learningPositions/useLearningPositionsSubscriptions', () => ({
  useLearningPositionsSubscriptions: vi.fn(),
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
import { useLearningPositionsQueries } from '../learningPositions/useLearningPositionsQueries';

// Helper to setup mock chain
const setupMockChain = (data: unknown, error: Error | null = null) => {
  const chainMock = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
  };
  mockSupabase.from.mockReturnValue(chainMock);
  return chainMock;
};

describe('useLearningPositionsQueries Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Fetching Flow', () => {
    it('should fetch learning positions for a user', async () => {
      const mockPositions = [
        createMockLearningPosition({ id: 'lp-1', symbol: 'AAPL' }),
        createMockLearningPosition({ id: 'lp-2', symbol: 'GOOGL' }),
      ];

      setupMockChain(mockPositions);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_positions');
      expect(result.current.positions).toHaveLength(2);
      expect(result.current.positions[0].symbol).toBe('AAPL');
    });

    it('should return empty array when no positions exist', async () => {
      setupMockChain([]);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.positions).toEqual([]);
    });

    it('should not fetch when userId is undefined', async () => {
      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningPositionsQueries(undefined),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.positions).toEqual([]);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Query Chain Verification', () => {
    it('should apply correct filters for active positions', async () => {
      const mockPositions = [createMockLearningPosition()];
      const chainMock = setupMockChain(mockPositions);

      const wrapper = createQueryClientWrapper();
      renderHook(
        () => useLearningPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_positions');
      expect(chainMock.select).toHaveBeenCalled();
      expect(chainMock.eq).toHaveBeenCalled();
      expect(chainMock.order).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      setupMockChain(null, new Error('Database error'));

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      // Should return empty array on error
      expect(result.current.positions).toEqual([]);
    });

    it('should handle null data response', async () => {
      setupMockChain(null);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.positions).toEqual([]);
    });
  });

  describe('Refetch Functionality', () => {
    it('should expose refetch function', async () => {
      setupMockChain([]);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('Position Data Structure', () => {
    it('should return positions with all required fields', async () => {
      const mockPosition = createMockLearningPosition({
        id: 'lp-1',
        symbol: 'AAPL',
        strike_price: 150,
        expiration: '2024-03-15',
        contracts: 2,
        premium_per_contract: 3.50,
        is_active: true,
        notes: 'Test note',
      });

      setupMockChain([mockPosition]);

      const wrapper = createQueryClientWrapper();
      const { result } = renderHook(
        () => useLearningPositionsQueries('test-user-id'),
        { wrapper }
      );

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.positions).toHaveLength(1);

      const position = result.current.positions[0];
      expect(position.id).toBe('lp-1');
      expect(position.symbol).toBe('AAPL');
      expect(position.strike_price).toBe(150);
      expect(position.expiration).toBe('2024-03-15');
      expect(position.contracts).toBe(2);
      expect(position.premium_per_contract).toBe(3.50);
      expect(position.is_active).toBe(true);
      expect(position.notes).toBe('Test note');
    });
  });
});
