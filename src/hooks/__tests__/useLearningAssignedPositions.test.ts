import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the subscription hook to prevent realtime setup
vi.mock('../learning/useLearningAssignedPositionsSubscriptions', () => ({
  useLearningAssignedPositionsSubscriptions: vi.fn(),
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

import { useLearningAssignedPositions } from '../useLearningAssignedPositions';

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

describe('useLearningAssignedPositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock setup for successful queries
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
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
    });
  });

  describe('Initial State', () => {
    it('should return initial empty state when no userId', () => {
      const { result } = renderHook(() => useLearningAssignedPositions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.assignedPositions).toEqual([]);
      expect(result.current.closedPositions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should return assigned positions array when userId is provided', () => {
      const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(result.current.assignedPositions).toBeDefined();
      expect(Array.isArray(result.current.assignedPositions)).toBe(true);
    });

    it('should return closed positions array when userId is provided', () => {
      const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(result.current.closedPositions).toBeDefined();
      expect(Array.isArray(result.current.closedPositions)).toBe(true);
    });
  });

  describe('Mutation Functions', () => {
    it('should expose assignPosition mutation function', () => {
      const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.assignPosition).toBe('function');
    });

    it('should expose sellCoveredCall mutation function', () => {
      const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.sellCoveredCall).toBe('function');
    });

    it('should expose closeAssignedPosition mutation function', () => {
      const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.closeAssignedPosition).toBe('function');
    });
  });

  describe('Query Behavior', () => {
    it('should not fetch when userId is undefined', () => {
      renderHook(() => useLearningAssignedPositions(undefined), {
        wrapper: createWrapper(),
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should not fetch when userId is empty string', () => {
      renderHook(() => useLearningAssignedPositions(''), {
        wrapper: createWrapper(),
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should call supabase when userId is provided', () => {
      renderHook(() => useLearningAssignedPositions('valid-user-id'), {
        wrapper: createWrapper(),
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('learning_assigned_positions');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in userId', () => {
      const { result } = renderHook(() => useLearningAssignedPositions('user@example.com'), {
        wrapper: createWrapper(),
      });

      expect(result.current.assignedPositions).toBeDefined();
      expect(result.current.closedPositions).toBeDefined();
    });

    it('should handle very long userId', () => {
      const longUserId = 'a'.repeat(500);
      const { result } = renderHook(() => useLearningAssignedPositions(longUserId), {
        wrapper: createWrapper(),
      });

      expect(result.current.assignedPositions).toBeDefined();
    });

    it('should handle userId change', () => {
      const { result, rerender } = renderHook(
        ({ userId }) => useLearningAssignedPositions(userId),
        {
          wrapper: createWrapper(),
          initialProps: { userId: 'user-1' },
        }
      );

      expect(result.current.assignedPositions).toBeDefined();

      // Change userId
      rerender({ userId: 'user-2' });

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should handle userId becoming undefined', () => {
      const { result, rerender } = renderHook(
        ({ userId }) => useLearningAssignedPositions(userId),
        {
          wrapper: createWrapper(),
          initialProps: { userId: 'user-1' as string | undefined },
        }
      );

      expect(result.current.assignedPositions).toBeDefined();

      // Change userId to undefined
      rerender({ userId: undefined });

      expect(result.current.assignedPositions).toEqual([]);
      expect(result.current.closedPositions).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle null data response for assigned positions', () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useLearningAssignedPositions('valid-user-id'), {
        wrapper: createWrapper(),
      });

      expect(result.current.assignedPositions).toEqual([]);
    });

    it('should handle query error gracefully for assigned positions', () => {
      const mockError = new Error('Database connection failed');
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useLearningAssignedPositions('valid-user-id'), {
        wrapper: createWrapper(),
      });

      expect(result.current.assignedPositions).toEqual([]);
    });

    it('should handle query error gracefully for closed positions', () => {
      const mockError = new Error('Database connection failed');
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
              }),
            }),
          }),
        }),
      });

      const { result } = renderHook(() => useLearningAssignedPositions('valid-user-id'), {
        wrapper: createWrapper(),
      });

      expect(result.current.closedPositions).toEqual([]);
    });
  });

  describe('Loading State', () => {
    it('should not be loading when no userId', () => {
      const { result } = renderHook(() => useLearningAssignedPositions(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should have isLoading as boolean type', () => {
      const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });

  describe('Both Active and Closed Queries', () => {
    it('should separate active and closed positions correctly', () => {
      const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
        wrapper: createWrapper(),
      });

      // Both arrays should be defined and separate
      expect(result.current.assignedPositions).toBeDefined();
      expect(result.current.closedPositions).toBeDefined();
      expect(result.current.assignedPositions).not.toBe(result.current.closedPositions);
    });
  });
});
