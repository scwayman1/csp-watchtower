import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the subscription hook to prevent realtime setup
vi.mock('../learningPositions/useLearningPositionsSubscriptions', () => ({
  useLearningPositionsSubscriptions: vi.fn(),
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({})),
      })),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
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
  });

  it('should return initial empty state when no userId', () => {
    const { result } = renderHook(() => useLearningPositions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.positions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return positions array', () => {
    const { result } = renderHook(() => useLearningPositions('test-user-id'), {
      wrapper: createWrapper(),
    });

    expect(result.current.positions).toBeDefined();
    expect(Array.isArray(result.current.positions)).toBe(true);
  });

  it('should expose mutation functions', () => {
    const { result } = renderHook(() => useLearningPositions('test-user-id'), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.addPosition).toBe('function');
    expect(typeof result.current.closePosition).toBe('function');
    expect(typeof result.current.deletePosition).toBe('function');
  });

  it('should expose refetch function', () => {
    const { result } = renderHook(() => useLearningPositions('test-user-id'), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.refetch).toBe('function');
  });

  it('should have isLoading state', () => {
    const { result } = renderHook(() => useLearningPositions('test-user-id'), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.isLoading).toBe('boolean');
  });
});
