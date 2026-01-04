import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeSubscription } from '../useRealtimeSubscription';
import { supabase } from '@/integrations/supabase/client';

// Mock timers
vi.useFakeTimers();

describe('useRealtimeSubscription', () => {
  const mockOnDataChange = vi.fn();
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.channel as any).mockReturnValue(mockChannel);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should call onDataChange on mount when fetchOnMount is true', () => {
    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        fetchOnMount: true,
      })
    );

    expect(mockOnDataChange).toHaveBeenCalledTimes(1);
  });

  it('should not call onDataChange on mount when fetchOnMount is false', () => {
    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        fetchOnMount: false,
      })
    );

    expect(mockOnDataChange).not.toHaveBeenCalled();
  });

  it('should create a channel for each table subscription', () => {
    const tables = [
      { table: 'table1' },
      { table: 'table2' },
      { table: 'table3' },
    ];

    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables,
        onDataChange: mockOnDataChange,
        fetchOnMount: false,
      })
    );

    expect(supabase.channel).toHaveBeenCalledTimes(3);
    expect(supabase.channel).toHaveBeenCalledWith('test-channel-table1-0');
    expect(supabase.channel).toHaveBeenCalledWith('test-channel-table2-1');
    expect(supabase.channel).toHaveBeenCalledWith('test-channel-table3-2');
  });

  it('should use default event "*" and schema "public" when not specified', () => {
    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        fetchOnMount: false,
      })
    );

    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'test_table',
      }),
      expect.any(Function)
    );
  });

  it('should use custom event and schema when specified', () => {
    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table', event: 'UPDATE', schema: 'custom' }],
        onDataChange: mockOnDataChange,
        fetchOnMount: false,
      })
    );

    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'custom',
        table: 'test_table',
      }),
      expect.any(Function)
    );
  });

  it('should call subscribe on each channel', () => {
    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        fetchOnMount: false,
      })
    );

    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('should remove channels on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        fetchOnMount: false,
      })
    );

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('should invoke refresh-market-data when refreshMarketData is true', async () => {
    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        refreshMarketData: true,
        fetchOnMount: false,
      })
    );

    // Wait for the initial refresh
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('refresh-market-data');
  });

  it('should not invoke refresh-market-data when refreshMarketData is false', () => {
    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        refreshMarketData: false,
        fetchOnMount: false,
      })
    );

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('should refresh market data at specified interval', async () => {
    const refreshInterval = 30000;

    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        refreshMarketData: true,
        refreshInterval,
        fetchOnMount: false,
      })
    );

    // Initial call
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);

    // Advance timer by refresh interval
    await act(async () => {
      vi.advanceTimersByTime(refreshInterval);
      await vi.runOnlyPendingTimersAsync();
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);

    // Advance again
    await act(async () => {
      vi.advanceTimersByTime(refreshInterval);
      await vi.runOnlyPendingTimersAsync();
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(3);
  });

  it('should clear interval on unmount', async () => {
    const { unmount } = renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        refreshMarketData: true,
        refreshInterval: 30000,
        fetchOnMount: false,
      })
    );

    // Initial call
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);

    unmount();

    // Advance timers - should not trigger more calls
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await vi.runOnlyPendingTimersAsync();
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple tables with different events', () => {
    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [
          { table: 'table1', event: 'INSERT' },
          { table: 'table2', event: 'UPDATE' },
          { table: 'table3', event: 'DELETE' },
        ],
        onDataChange: mockOnDataChange,
        fetchOnMount: false,
      })
    );

    expect(mockChannel.on).toHaveBeenCalledTimes(3);
    expect(mockChannel.on).toHaveBeenNthCalledWith(
      1,
      'postgres_changes',
      expect.objectContaining({ event: 'INSERT', table: 'table1' }),
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenNthCalledWith(
      2,
      'postgres_changes',
      expect.objectContaining({ event: 'UPDATE', table: 'table2' }),
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenNthCalledWith(
      3,
      'postgres_changes',
      expect.objectContaining({ event: 'DELETE', table: 'table3' }),
      expect.any(Function)
    );
  });

  it('should call onDataChange when postgres_changes event is received', () => {
    let changeHandler: (() => void) | undefined;
    
    mockChannel.on.mockImplementation((event, config, handler) => {
      changeHandler = handler;
      return mockChannel;
    });

    renderHook(() =>
      useRealtimeSubscription({
        channelName: 'test-channel',
        tables: [{ table: 'test_table' }],
        onDataChange: mockOnDataChange,
        fetchOnMount: false,
      })
    );

    expect(mockOnDataChange).not.toHaveBeenCalled();

    // Simulate receiving a change event
    act(() => {
      changeHandler?.();
    });

    expect(mockOnDataChange).toHaveBeenCalledTimes(1);
  });
});
