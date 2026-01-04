import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the subscription hook to prevent realtime setup
vi.mock('../learningPositions/useLearningPositionsSubscriptions', () => ({
  useLearningPositionsSubscriptions: vi.fn(),
}));

const mockSupabase = {
  from: vi.fn(),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn(() => ({})),
    })),
  })),
  removeChannel: vi.fn(),
};

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

const mockToast = vi.fn();
// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

import { useLearningPositions } from '../useLearningPositions';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useLearningPositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock setup for successful queries
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
  });

  describe('Initial State', () => {
    it('should return initial empty state when no userId', () => {
      const { result } = renderHook(() => useLearningPositions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.positions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should return positions array when userId is provided', () => {
      const { result } = renderHook(() => useLearningPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(result.current.positions).toBeDefined();
      expect(Array.isArray(result.current.positions)).toBe(true);
    });

    it('should have isLoading boolean type when userId is provided', () => {
      const { result } = renderHook(() => useLearningPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });

  describe('Mutation Functions', () => {
    it('should expose addPosition mutation function', () => {
      const { result } = renderHook(() => useLearningPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.addPosition).toBe('function');
    });

    it('should expose closePosition mutation function', () => {
      const { result } = renderHook(() => useLearningPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.closePosition).toBe('function');
    });

    it('should expose deletePosition mutation function', () => {
      const { result } = renderHook(() => useLearningPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.deletePosition).toBe('function');
    });

    it('should expose refetch function', () => {
      const { result } = renderHook(() => useLearningPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('Query Behavior', () => {
    it('should not fetch when userId is undefined', () => {
      renderHook(() => useLearningPositions(undefined), {
        wrapper: createWrapper(),
      });

      // Query is disabled when userId is falsy
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should not fetch when userId is empty string', () => {
      renderHook(() => useLearningPositions(''), {
        wrapper: createWrapper(),
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should call supabase when userId is provided', () => {
      renderHook(() => useLearningPositions('valid-user-id'), {
        wrapper: createWrapper(),
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_positions');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in userId', () => {
      const { result } = renderHook(() => useLearningPositions('user@example.com'), {
        wrapper: createWrapper(),
      });

      expect(result.current.positions).toBeDefined();
    });

    it('should handle very long userId', () => {
      const longUserId = 'a'.repeat(500);
      const { result } = renderHook(() => useLearningPositions(longUserId), {
        wrapper: createWrapper(),
      });

      expect(result.current.positions).toBeDefined();
    });

    it('should handle userId change', () => {
      const { result, rerender } = renderHook(
        ({ userId }) => useLearningPositions(userId),
        {
          wrapper: createWrapper(),
          initialProps: { userId: 'user-1' },
        }
      );

      expect(result.current.positions).toBeDefined();

      // Change userId
      rerender({ userId: 'user-2' });

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should handle userId becoming undefined', () => {
      const { result, rerender } = renderHook(
        ({ userId }) => useLearningPositions(userId),
        {
          wrapper: createWrapper(),
          initialProps: { userId: 'user-1' as string | undefined },
        }
      );

      expect(result.current.positions).toBeDefined();

      // Change userId to undefined
      rerender({ userId: undefined });

      expect(result.current.positions).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle null data response gracefully', () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useLearningPositions('valid-user-id'), {
        wrapper: createWrapper(),
      });

      // Default value should be used
      expect(result.current.positions).toEqual([]);
    });

    it('should handle query error by returning default value', () => {
      const mockError = new Error('Database connection failed');
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useLearningPositions('valid-user-id'), {
        wrapper: createWrapper(),
      });

      // Should still return empty array due to default value
      expect(result.current.positions).toEqual([]);
    });
  });

  describe('Loading State', () => {
    it('should not be loading when no userId', () => {
      const { result } = renderHook(() => useLearningPositions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should have isLoading as boolean type', () => {
      const { result } = renderHook(() => useLearningPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });
});
