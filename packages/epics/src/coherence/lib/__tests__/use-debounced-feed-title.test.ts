// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedFeedTitle } from '../use-debounced-feed-title';

describe('useDebouncedFeedTitle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the field immediately and commits the trimmed query after 300ms', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedFeedTitle({ committed: '', onCommit, delayMs: 300 }),
    );

    act(() => {
      result.current.onTitleChange('  Garden ');
    });
    expect(result.current.titleInput).toBe('  Garden ');
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Garden');
  });

  it('commits an empty query when the field is cleared', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedFeedTitle({ committed: 'Garden', onCommit, delayMs: 300 }),
    );

    act(() => {
      result.current.onTitleChange('');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onCommit).toHaveBeenCalledWith('');
  });

  it('follows a committed query from back/forward without clobbering a newer keystroke', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }: { committed: string }) =>
        useDebouncedFeedTitle({ committed, onCommit, delayMs: 300 }),
      { initialProps: { committed: '' } },
    );

    act(() => {
      result.current.onTitleChange('soil');
    });
    rerender({ committed: '' });
    expect(result.current.titleInput).toBe('soil');

    rerender({ committed: 'soil' });
    expect(result.current.titleInput).toBe('soil');

    rerender({ committed: 'water' });
    expect(result.current.titleInput).toBe('water');
  });
});
