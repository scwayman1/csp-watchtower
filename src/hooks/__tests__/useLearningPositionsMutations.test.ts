import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useLearningPositionsMutations } from '../learningPositions/useLearningPositionsMutations';

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

// Mock chain builders
const createMockChain = (finalResult: { data?: any; error?: any }) => {
  const chain: any = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
  };
  // For delete, it doesn't need .select().single()
  chain.delete = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue(finalResult),
  });
  // For update, it doesn't need .select().single()
  chain.update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue(finalResult),
  });
  return chain;
};

describe('useLearningPositionsMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should return mutation functions', () => {
      const mockChain = createMockChain({ data: null, error: null });
      mockFrom.mockReturnValue(mockChain);

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      expect(result.current).toHaveProperty('addPosition');
      expect(result.current).toHaveProperty('closePosition');
      expect(result.current).toHaveProperty('deletePosition');
    });

    it('should return functions even without userId', () => {
      const mockChain = createMockChain({ data: null, error: null });
      mockFrom.mockReturnValue(mockChain);

      const { result } = renderHook(
        () => useLearningPositionsMutations(),
        { wrapper: createWrapper() }
      );

      expect(typeof result.current.addPosition).toBe('function');
      expect(typeof result.current.closePosition).toBe('function');
      expect(typeof result.current.deletePosition).toBe('function');
    });
  });

  describe('addPosition Mutation', () => {
    it('should call supabase insert with correct data', async () => {
      const mockData = {
        id: 'new-position-id',
        symbol: 'AAPL',
        strike_price: 150,
        expiration: '2025-12-20',
        contracts: 1,
        premium_per_contract: 2.5,
      };

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.addPosition({
          symbol: 'AAPL',
          strike_price: 150,
          expiration: '2025-12-20',
          contracts: 1,
          premium_per_contract: 2.5,
        });
      });

      expect(mockFrom).toHaveBeenCalledWith('learning_positions');
      expect(insertMock).toHaveBeenCalled();
    });

    it('should show success toast on successful insert', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: '123' }, error: null }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result, waitFor } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.addPosition({
          symbol: 'AAPL',
          strike_price: 150,
          expiration: '2025-12-20',
          contracts: 1,
          premium_per_contract: 2.5,
        });
      });

      // Wait for the mutation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Practice position added",
        })
      );
    });

    it('should show error toast on failed insert', async () => {
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
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.addPosition({
          symbol: 'AAPL',
          strike_price: 150,
          expiration: '2025-12-20',
          contracts: 1,
          premium_per_contract: 2.5,
        });
      });

      // Wait for the mutation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to add position",
          variant: "destructive",
        })
      );
    });
  });

  describe('closePosition Mutation', () => {
    it('should call supabase update with correct data', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      
      mockFrom.mockReturnValue({ update: updateMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.closePosition('position-id-123');
      });

      expect(mockFrom).toHaveBeenCalledWith('learning_positions');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      );
      expect(eqMock).toHaveBeenCalledWith('id', 'position-id-123');
    });

    it('should show success toast on successful close', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      
      mockFrom.mockReturnValue({ update: updateMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.closePosition('position-id-123');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Position closed",
        })
      );
    });

    it('should show error toast on failed close', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: { message: 'Update failed' } });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      
      mockFrom.mockReturnValue({ update: updateMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.closePosition('position-id-123');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to close position",
          variant: "destructive",
        })
      );
    });
  });

  describe('deletePosition Mutation', () => {
    it('should call supabase delete with correct id', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
      
      mockFrom.mockReturnValue({ delete: deleteMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.deletePosition('position-id-456');
      });

      expect(mockFrom).toHaveBeenCalledWith('learning_positions');
      expect(deleteMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('id', 'position-id-456');
    });

    it('should show success toast on successful delete', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
      
      mockFrom.mockReturnValue({ delete: deleteMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.deletePosition('position-id-456');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Position deleted",
        })
      );
    });

    it('should show error toast on failed delete', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
      
      mockFrom.mockReturnValue({ delete: deleteMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.deletePosition('position-id-456');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to delete position",
          variant: "destructive",
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty position id for close', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      
      mockFrom.mockReturnValue({ update: updateMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.closePosition('');
      });

      expect(eqMock).toHaveBeenCalledWith('id', '');
    });

    it('should handle special characters in position id', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
      
      mockFrom.mockReturnValue({ delete: deleteMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      const specialId = 'id-with-special-chars-!@#$%';
      await act(async () => {
        result.current.deletePosition(specialId);
      });

      expect(eqMock).toHaveBeenCalledWith('id', specialId);
    });

    it('should handle position with minimal required fields', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: '123' }, error: null }),
        }),
      });
      
      mockFrom.mockReturnValue({ insert: insertMock });

      const { result } = renderHook(
        () => useLearningPositionsMutations('test-user-id'),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        result.current.addPosition({
          symbol: 'X',
          strike_price: 0,
          expiration: '2025-01-01',
          contracts: 1,
          premium_per_contract: 0,
        });
      });

      expect(insertMock).toHaveBeenCalled();
    });
  });
});
