import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useLearningAssignedPositionsMutations } from '../learning/useLearningAssignedPositionsMutations';

// Mock Supabase client
const mockFrom = vi.fn();
const mockSupabase = {
  from: mockFrom,
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe('useLearningAssignedPositionsMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should return mutation functions', () => {
      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      expect(result.current).toHaveProperty('assignPosition');
      expect(result.current).toHaveProperty('sellCoveredCall');
      expect(result.current).toHaveProperty('closeAssignedPosition');
    });

    it('should return functions even without userId', () => {
      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations(),
        { wrapper: createWrapper() }
      );

      expect(typeof result.current.assignPosition).toBe('function');
      expect(typeof result.current.sellCoveredCall).toBe('function');
      expect(typeof result.current.closeAssignedPosition).toBe('function');
    });
  });

  describe('assignPosition Mutation', () => {
    it('should call supabase insert with correct data', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'assigned-position-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.assignPosition({
          symbol: 'AAPL',
          shares: 100,
          assignment_price: 150,
          original_put_premium: 250,
        });
      });

      expect(mockFrom).toHaveBeenCalledWith('learning_assigned_positions');
      expect(insertMock).toHaveBeenCalled();
    });

    it('should calculate cost_basis correctly', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'assigned-position-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.assignPosition({
          symbol: 'AAPL',
          shares: 100,
          assignment_price: 150,
          original_put_premium: 250,
        });
      });

      // Verify insert was called with correct cost_basis (150 * 100 = 15000)
      const insertCall = insertMock.mock.calls[0][0][0];
      expect(insertCall.cost_basis).toBe(15000);
    });

    it('should show success toast on successful assign', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'assigned-position-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.assignPosition({
          symbol: 'AAPL',
          shares: 100,
          assignment_price: 150,
          original_put_premium: 250,
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Position assigned",
        })
      );
    });

    it('should show error toast on failed assign', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Insert failed' } 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.assignPosition({
          symbol: 'AAPL',
          shares: 100,
          assignment_price: 150,
          original_put_premium: 250,
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to assign position",
          variant: "destructive",
        })
      );
    });
  });

  describe('sellCoveredCall Mutation', () => {
    it('should call supabase insert with correct data', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'covered-call-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.sellCoveredCall({
          learning_assigned_position_id: 'position-123',
          strike_price: 160,
          expiration: '2025-12-20',
          premium_per_contract: 3.5,
          contracts: 1,
        });
      });

      expect(mockFrom).toHaveBeenCalledWith('learning_covered_calls');
      expect(insertMock).toHaveBeenCalled();
    });

    it('should include is_active: true in the insert', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'covered-call-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.sellCoveredCall({
          learning_assigned_position_id: 'position-123',
          strike_price: 160,
          expiration: '2025-12-20',
          premium_per_contract: 3.5,
          contracts: 1,
        });
      });

      const insertCall = insertMock.mock.calls[0][0][0];
      expect(insertCall.is_active).toBe(true);
    });

    it('should show success toast on successful sell', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'covered-call-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.sellCoveredCall({
          learning_assigned_position_id: 'position-123',
          strike_price: 160,
          expiration: '2025-12-20',
          premium_per_contract: 3.5,
          contracts: 1,
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Covered call sold",
        })
      );
    });

    it('should show error toast on failed sell', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Insert failed' } 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.sellCoveredCall({
          learning_assigned_position_id: 'position-123',
          strike_price: 160,
          expiration: '2025-12-20',
          premium_per_contract: 3.5,
          contracts: 1,
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to sell covered call",
          variant: "destructive",
        })
      );
    });
  });

  describe('closeAssignedPosition Mutation', () => {
    it('should fetch position first then update for full close', async () => {
      // Mock for fetch
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { 
              id: 'position-123',
              shares: 100,
              cost_basis: 15000,
              original_put_premium: 250,
              user_id: 'test-user-id',
              symbol: 'AAPL',
            }, 
            error: null 
          }),
        }),
      });

      // Mock for update
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      
      mockFrom.mockImplementation((table) => {
        if (table === 'learning_assigned_positions') {
          return { 
            select: selectMock,
            update: updateMock,
          };
        }
        return {};
      });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.closeAssignedPosition({
          id: 'position-123',
          sold_price: 160,
        });
      });

      expect(mockFrom).toHaveBeenCalledWith('learning_assigned_positions');
      expect(selectMock).toHaveBeenCalled();
    });

    it('should show success toast with share count and price', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { 
              id: 'position-123',
              shares: 100,
              cost_basis: 15000,
              original_put_premium: 250,
            }, 
            error: null 
          }),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      
      mockFrom.mockReturnValue({ 
        select: selectMock,
        update: updateMock,
      });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.closeAssignedPosition({
          id: 'position-123',
          sold_price: 160,
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Shares sold",
          description: expect.stringContaining('100'),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero shares assignment', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'position-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.assignPosition({
          symbol: 'AAPL',
          shares: 0,
          assignment_price: 150,
          original_put_premium: 0,
        });
      });

      const insertCall = insertMock.mock.calls[0][0][0];
      expect(insertCall.shares).toBe(0);
      expect(insertCall.cost_basis).toBe(0);
    });

    it('should handle very large premium values', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'call-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.sellCoveredCall({
          learning_assigned_position_id: 'position-123',
          strike_price: 999999,
          expiration: '2025-12-20',
          premium_per_contract: 999999.99,
          contracts: 1000,
        });
      });

      const insertCall = insertMock.mock.calls[0][0][0];
      expect(insertCall.strike_price).toBe(999999);
      expect(insertCall.premium_per_contract).toBe(999999.99);
    });

    it('should include original_learning_position_id when provided', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: 'position-id' }, 
            error: null 
          }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningAssignedPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.assignPosition({
          symbol: 'AAPL',
          shares: 100,
          assignment_price: 150,
          original_put_premium: 250,
          original_learning_position_id: 'original-position-xyz',
        });
      });

      const insertCall = insertMock.mock.calls[0][0][0];
      expect(insertCall.original_learning_position_id).toBe('original-position-xyz');
    });
  });
});
