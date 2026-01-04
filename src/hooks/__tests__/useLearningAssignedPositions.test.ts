import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the subscription hook to prevent realtime setup
vi.mock('../learning/useLearningAssignedPositionsSubscriptions', () => ({
  useLearningAssignedPositionsSubscriptions: vi.fn(),
}));

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            not: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
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
  });

  it('should return initial empty state when no userId', () => {
    const { result } = renderHook(() => useLearningAssignedPositions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.assignedPositions).toEqual([]);
    expect(result.current.closedPositions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return assigned positions array', () => {
    const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
      wrapper: createWrapper(),
    });

    expect(result.current.assignedPositions).toBeDefined();
    expect(Array.isArray(result.current.assignedPositions)).toBe(true);
  });

  it('should return closed positions array', () => {
    const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
      wrapper: createWrapper(),
    });

    expect(result.current.closedPositions).toBeDefined();
    expect(Array.isArray(result.current.closedPositions)).toBe(true);
  });

  it('should expose mutation functions', () => {
    const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.assignPosition).toBe('function');
    expect(typeof result.current.sellCoveredCall).toBe('function');
    expect(typeof result.current.closeAssignedPosition).toBe('function');
  });

  it('should have isLoading state', () => {
    const { result } = renderHook(() => useLearningAssignedPositions('test-user-id'), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.isLoading).toBe('boolean');
  });
});
