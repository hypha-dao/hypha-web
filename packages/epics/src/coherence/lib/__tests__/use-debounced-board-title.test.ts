// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SignalBoardFilters } from '@hypha-platform/core/client';
import { useDebouncedBoardTitle } from '../use-debounced-board-title';

describe('useDebouncedBoardTitle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the input immediately and writes the filter after debounce', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedBoardTitle({
        filters: {},
        onChange,
        delayMs: 300,
      }),
    );

    act(() => {
      result.current.onTitleChange('me');
    });
    expect(result.current.titleInput).toBe('me');
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ title: 'me' });
  });

  it('pre-fills from a shared title= URL and resets on Clear', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ filters }: { filters: SignalBoardFilters }) =>
        useDebouncedBoardTitle({ filters, onChange, delayMs: 300 }),
      {
        initialProps: { filters: { title: 'memo' } as SignalBoardFilters },
      },
    );

    expect(result.current.titleInput).toBe('memo');

    act(() => {
      result.current.onTitleChange('memorandum');
    });
    expect(result.current.titleInput).toBe('memorandum');
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      result.current.resetTitle();
    });
    expect(result.current.titleInput).toBe('');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).not.toHaveBeenCalled();

    rerender({ filters: {} as SignalBoardFilters });
    expect(result.current.titleInput).toBe('');
  });

  it('does not clobber in-progress typing when the last commit lands', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ filters }: { filters: SignalBoardFilters }) =>
        useDebouncedBoardTitle({ filters, onChange, delayMs: 300 }),
      { initialProps: { filters: {} } },
    );

    act(() => {
      result.current.onTitleChange('ab');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledWith({ title: 'ab' });

    act(() => {
      result.current.onTitleChange('abc');
    });
    rerender({ filters: { title: 'ab' } });
    expect(result.current.titleInput).toBe('abc');
  });

  it('keeps a trailing space after debounce, then continues as foo bar', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ filters }: { filters: SignalBoardFilters }) =>
        useDebouncedBoardTitle({ filters, onChange, delayMs: 300 }),
      { initialProps: { filters: {} as SignalBoardFilters } },
    );

    act(() => {
      result.current.onTitleChange('foo ');
    });
    expect(result.current.titleInput).toBe('foo ');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ title: 'foo' });

    rerender({ filters: { title: 'foo' } as SignalBoardFilters });
    expect(result.current.titleInput).toBe('foo ');

    act(() => {
      result.current.onTitleChange('foo bar');
    });
    expect(result.current.titleInput).toBe('foo bar');
  });

  it('cancels a pending URL write when the board unmounts', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedBoardTitle({
        filters: {},
        onChange,
        delayMs: 300,
      }),
    );

    act(() => {
      result.current.onTitleChange('half');
    });
    expect(result.current.titleInput).toBe('half');
    expect(onChange).not.toHaveBeenCalled();

    unmount();
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('syncs the input when the URL changes from outside the hook', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ filters }: { filters: SignalBoardFilters }) =>
        useDebouncedBoardTitle({ filters, onChange, delayMs: 300 }),
      {
        initialProps: { filters: { title: 'memo' } as SignalBoardFilters },
      },
    );

    expect(result.current.titleInput).toBe('memo');
    rerender({ filters: { title: 'hello' } as SignalBoardFilters });
    expect(result.current.titleInput).toBe('hello');
  });
});
