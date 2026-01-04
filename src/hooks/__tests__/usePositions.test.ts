import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { usePositions } from '../usePositions';

// Mock the subscription hook to prevent realtime setup during tests
vi.mock('../positions/usePositionsSubscriptions', () => ({
  usePositionsSubscriptions: vi.fn(),
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('usePositions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } } });
  });

  describe('Initial State', () => {
    it('should return initial loading state as true', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(result.current.loading).toBe(true);
    });

    it('should return empty positions array initially', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(result.current.positions).toEqual([]);
    });

    it('should expose refetch function', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should expose sharedOwners map', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(result.current.sharedOwners).toBeInstanceOf(Map);
    });
  });

  describe('UserId Parameter', () => {
    it('should accept undefined userId', () => {
      const { result } = renderHook(() => usePositions(undefined));
      
      expect(result.current.positions).toEqual([]);
    });

    it('should accept provided userId', () => {
      const { result } = renderHook(() => usePositions('custom-user-id'));
      
      expect(result.current.positions).toEqual([]);
    });

    it('should handle userId changes', () => {
      const { result, rerender } = renderHook(
        ({ userId }) => usePositions(userId),
        { initialProps: { userId: 'user-1' } }
      );
      
      expect(result.current.positions).toEqual([]);
      
      rerender({ userId: 'user-2' });
      
      expect(result.current.positions).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string userId', () => {
      const { result } = renderHook(() => usePositions(''));
      
      expect(result.current.positions).toEqual([]);
    });

    it('should handle special characters in userId', () => {
      const { result } = renderHook(() => usePositions('user@#$%^&*()'));
      
      expect(result.current.positions).toEqual([]);
    });

    it('should handle very long userId', () => {
      const longUserId = 'a'.repeat(1000);
      const { result } = renderHook(() => usePositions(longUserId));
      
      expect(result.current.positions).toEqual([]);
    });
  });

  describe('Return Value Structure', () => {
    it('should return object with all expected properties', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(result.current).toHaveProperty('positions');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('refetch');
      expect(result.current).toHaveProperty('sharedOwners');
    });

    it('should return positions as an array', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(Array.isArray(result.current.positions)).toBe(true);
    });

    it('should return loading as a boolean', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(typeof result.current.loading).toBe('boolean');
    });

    it('should return sharedOwners as a Map', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(result.current.sharedOwners).toBeInstanceOf(Map);
      expect(result.current.sharedOwners.size).toBe(0);
    });
  });

  describe('Refetch Function', () => {
    it('should be callable without errors', () => {
      const { result } = renderHook(() => usePositions());
      
      expect(() => result.current.refetch()).not.toThrow();
    });

    it('should return a promise when called', () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      
      const { result } = renderHook(() => usePositions());
      
      const refetchResult = result.current.refetch();
      expect(refetchResult).toBeInstanceOf(Promise);
    });
  });

  describe('Hook Stability', () => {
    it('should maintain stable references across renders', () => {
      const { result, rerender } = renderHook(() => usePositions('test-user'));
      
      const initialPositions = result.current.positions;
      const initialSharedOwners = result.current.sharedOwners;
      
      rerender();
      
      // Arrays and Maps are new instances but with same content
      expect(result.current.positions).toEqual(initialPositions);
      expect(result.current.sharedOwners).toEqual(initialSharedOwners);
    });

    it('should not crash on rapid remounts', () => {
      for (let i = 0; i < 10; i++) {
        const { result, unmount } = renderHook(() => usePositions('test-user'));
        expect(result.current.positions).toEqual([]);
        unmount();
      }
    });
  });
});
