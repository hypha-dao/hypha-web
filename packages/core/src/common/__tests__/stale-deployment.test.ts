import { describe, it, expect, vi } from 'vitest';
import {
  STALE_RELOAD_DELAY_MS,
  STALE_RELOAD_STORAGE_KEY,
  STALE_RELOAD_WINDOW_MS,
  createStaleDeployment,
  createWorkInProgressTracker,
  isActionNotFoundError,
} from '../stale-deployment';

const missingAction = () =>
  new Error(
    'Server Action "40abc" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action',
  );

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

function setup(
  overrides: Partial<Parameters<typeof createStaleDeployment>[0]> = {},
) {
  const storage = memoryStorage();
  const reload = vi.fn();
  const timers: Array<() => void> = [];
  let clock = 1_000_000;
  const stale = createStaleDeployment({
    getStorage: () => storage,
    now: () => clock,
    isWorkInProgress: () => false,
    reload,
    schedule: (fn) => void timers.push(fn),
    ...overrides,
  });
  const runTimers = () => timers.splice(0).forEach((fn) => fn());
  return {
    stale,
    storage,
    reload,
    runTimers,
    advance: (ms: number) => void (clock += ms),
  };
}

describe('isActionNotFoundError', () => {
  it('matches the Next.js missing-action message', () => {
    expect(isActionNotFoundError(missingAction())).toBe(true);
  });

  it('matches the Next.js error code even if the message changes', () => {
    const error = new Error('different wording');
    Object.defineProperty(error, '__NEXT_ERROR_CODE', { value: 'E715' });
    expect(isActionNotFoundError(error)).toBe(true);
  });

  it('does not match other errors', () => {
    expect(isActionNotFoundError(new Error('Not Found'))).toBe(false);
    expect(
      isActionNotFoundError(
        new Error('An unexpected response was received from the server.'),
      ),
    ).toBe(false);
    expect(isActionNotFoundError({ status: 404 })).toBe(false);
    expect(isActionNotFoundError(null)).toBe(false);
    expect(isActionNotFoundError(undefined)).toBe(false);
    expect(isActionNotFoundError('Server Action not found')).toBe(false);
  });
});

describe('createStaleDeployment', () => {
  it('ignores other errors: no state change, no reload', () => {
    const { stale, reload, runTimers } = setup();
    expect(stale.handleError(new Error('boom'))).toBe(false);
    runTimers();
    expect(stale.getStatus()).toBe('idle');
    expect(stale.isStale()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once after the notice delay on a missing action', () => {
    const { stale, reload, runTimers, storage } = setup();
    expect(stale.handleError(missingAction())).toBe(true);
    expect(stale.getStatus()).toBe('reloading');
    expect(stale.isStale()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    runTimers();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.data.has(STALE_RELOAD_STORAGE_KEY)).toBe(true);
  });

  it('a burst of errors schedules a single reload', () => {
    const { stale, reload, runTimers } = setup();
    for (let i = 0; i < 12; i++) stale.handleError(missingAction());
    runTimers();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again inside the guard window, shows the banner', () => {
    const { stale, storage, reload, runTimers } = setup();
    storage.setItem(STALE_RELOAD_STORAGE_KEY, String(1_000_000 - 60_000));
    stale.handleError(missingAction());
    runTimers();
    expect(reload).not.toHaveBeenCalled();
    expect(stale.getStatus()).toBe('banner');
  });

  it('can reload again once the window has passed', () => {
    const { stale, storage, reload, runTimers } = setup();
    storage.setItem(
      STALE_RELOAD_STORAGE_KEY,
      String(1_000_000 - STALE_RELOAD_WINDOW_MS - 1),
    );
    stale.handleError(missingAction());
    runTimers();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a second error after a reload inside the window does not reload', () => {
    const first = setup();
    first.stale.handleError(missingAction());
    first.runTimers();
    expect(first.reload).toHaveBeenCalledTimes(1);

    // Same tab after the reload: fresh module state, same sessionStorage.
    const second = setup({ getStorage: () => first.storage });
    second.advance(STALE_RELOAD_DELAY_MS + 1000);
    second.stale.handleError(missingAction());
    second.runTimers();
    expect(second.reload).not.toHaveBeenCalled();
    expect(second.stale.getStatus()).toBe('banner');
  });

  it('shows the banner instead of reloading when work is in progress', () => {
    const { stale, reload, runTimers } = setup({
      isWorkInProgress: () => true,
    });
    stale.handleError(missingAction());
    runTimers();
    expect(stale.getStatus()).toBe('banner');
    expect(stale.isStale()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it('switches to the banner if work starts during the notice delay', () => {
    let busy = false;
    const { stale, reload, runTimers } = setup({
      isWorkInProgress: () => busy,
    });
    stale.handleError(missingAction());
    expect(stale.getStatus()).toBe('reloading');
    busy = true;
    runTimers();
    expect(reload).not.toHaveBeenCalled();
    expect(stale.getStatus()).toBe('banner');
  });

  it('does not reload when storage cannot be read', () => {
    const { stale, reload, runTimers } = setup({
      getStorage: () => {
        throw new Error('blocked');
      },
    });
    stale.handleError(missingAction());
    runTimers();
    expect(reload).not.toHaveBeenCalled();
    expect(stale.getStatus()).toBe('banner');
  });

  it('does not reload when storage cannot be written', () => {
    const { stale, reload, runTimers } = setup({
      getStorage: () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
      }),
    });
    stale.handleError(missingAction());
    runTimers();
    expect(reload).not.toHaveBeenCalled();
    expect(stale.getStatus()).toBe('banner');
  });

  it('does not reload when the write is silently dropped', () => {
    const { stale, reload, runTimers } = setup({
      getStorage: () => ({ getItem: () => null, setItem: () => undefined }),
    });
    stale.handleError(missingAction());
    runTimers();
    expect(reload).not.toHaveBeenCalled();
    expect(stale.getStatus()).toBe('banner');
  });

  it('stops SWR retrying only that error', () => {
    const { stale } = setup();
    expect(stale.shouldRetryOnError(missingAction())).toBe(false);
    expect(stale.shouldRetryOnError(new Error('network'))).toBe(true);
  });

  it('notifies subscribers on status changes', () => {
    const { stale } = setup();
    const listener = vi.fn();
    const unsubscribe = stale.subscribe(listener);
    stale.handleError(missingAction());
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    stale.handleError(missingAction());
    expect(listener).not.toHaveBeenCalled();
  });

  it('wrapFetcher rejects without calling the fetcher once stale', async () => {
    const { stale } = setup({ isWorkInProgress: () => true });
    const fetcher = vi.fn().mockResolvedValue('ok');
    const wrapped = stale.wrapFetcher(fetcher);
    await expect(wrapped('k')).resolves.toBe('ok');
    stale.handleError(missingAction());
    await expect(wrapped('k')).rejects.toSatisfy(isActionNotFoundError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('createWorkInProgressTracker', () => {
  it('is idle by default', () => {
    expect(createWorkInProgressTracker().isActive()).toBe(false);
  });

  it('becomes active after user input and stays active', () => {
    const tracker = createWorkInProgressTracker();
    tracker.markUserInput();
    expect(tracker.isActive()).toBe(true);
  });

  it('is active while any probe reports work, and not after removal', () => {
    const tracker = createWorkInProgressTracker();
    let active = true;
    const remove = tracker.addProbe(() => active);
    expect(tracker.isActive()).toBe(true);
    active = false;
    expect(tracker.isActive()).toBe(false);
    active = true;
    remove();
    expect(tracker.isActive()).toBe(false);
  });

  it('a throwing probe counts as work in progress (safe side)', () => {
    const tracker = createWorkInProgressTracker();
    tracker.addProbe(() => {
      throw new Error('x');
    });
    expect(tracker.isActive()).toBe(true);
  });
});
