import { describe, expect, it, vi } from 'vitest';
import {
  BOUND_LOOKUP_MAX_ATTEMPTS,
  BOUND_LOOKUP_RETRY_BASE_MS,
  MAX_BOUND_LOOKUP_IDS,
  createBoundRoomLookup,
} from '../bound-room-lookup';

function setup(lookup: (ids: string[], token: string) => Promise<string[]>) {
  let time = 0;
  const onBound = vi.fn();
  const onError = vi.fn();
  const fn = vi.fn(lookup);
  const lookupState = createBoundRoomLookup({
    lookup: fn,
    onBound,
    onError,
    now: () => time,
  });
  return {
    ...lookupState,
    fn,
    onBound,
    onError,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

const rooms = ['!a:hs', '!b:hs'];

describe('createBoundRoomLookup', () => {
  it('marks rooms checked on success and stops calling', async () => {
    const t = setup(async () => ['!a:hs']);
    await t.refresh(rooms, 'tok');
    for (let i = 0; i < 5; i++) await t.refresh(rooms, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(1);
    expect(t.fn).toHaveBeenCalledWith(rooms, 'tok');
    expect(t.onBound).toHaveBeenCalledWith(['!a:hs']);
  });

  it('calls once for a changed room set, only with the new ids', async () => {
    const t = setup(async () => []);
    await t.refresh(rooms, 'tok');
    await t.refresh([...rooms, '!c:hs'], 'tok');
    expect(t.fn).toHaveBeenCalledTimes(2);
    expect(t.fn).toHaveBeenLastCalledWith(['!c:hs'], 'tok');
  });

  it('does not retry a failed lookup on every sync', async () => {
    const t = setup(async () => {
      throw new Error('Server Action "x" was not found on the server');
    });
    for (let i = 0; i < 50; i++) {
      await t.refresh(rooms, 'tok');
      t.advance(30_000);
    }
    // 50 syncs over 25 min: first try, then the 5 min and 10 min retries.
    expect(t.fn).toHaveBeenCalledTimes(BOUND_LOOKUP_MAX_ATTEMPTS);
    expect(t.onError).toHaveBeenCalledTimes(BOUND_LOOKUP_MAX_ATTEMPTS);
    expect(t.onBound).not.toHaveBeenCalled();
  });

  it('retries after the backoff, doubling the delay', async () => {
    const t = setup(async () => {
      throw new Error('boom');
    });
    await t.refresh(rooms, 'tok');
    t.advance(BOUND_LOOKUP_RETRY_BASE_MS - 1);
    await t.refresh(rooms, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(1);
    t.advance(1);
    await t.refresh(rooms, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(2);
    t.advance(BOUND_LOOKUP_RETRY_BASE_MS);
    await t.refresh(rooms, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(2);
    t.advance(BOUND_LOOKUP_RETRY_BASE_MS);
    await t.refresh(rooms, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after the retry limit until reset', async () => {
    const t = setup(async () => {
      throw new Error('boom');
    });
    for (let i = 0; i < 10; i++) {
      await t.refresh(rooms, 'tok');
      t.advance(24 * 60 * 60_000);
    }
    expect(t.fn).toHaveBeenCalledTimes(BOUND_LOOKUP_MAX_ATTEMPTS);
    t.reset();
    await t.refresh(rooms, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(BOUND_LOOKUP_MAX_ATTEMPTS + 1);
  });

  it('recovers when a retry succeeds', async () => {
    let fail = true;
    const t = setup(async () => {
      if (fail) throw new Error('boom');
      return [];
    });
    await t.refresh(rooms, 'tok');
    fail = false;
    t.advance(BOUND_LOOKUP_RETRY_BASE_MS);
    await t.refresh(rooms, 'tok');
    await t.refresh(rooms, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(2);
  });

  it('does not start a second lookup while one is in flight', async () => {
    let release: (ids: string[]) => void = () => undefined;
    const t = setup(() => new Promise<string[]>((r) => (release = r)));
    const first = t.refresh(rooms, 'tok');
    await t.refresh(rooms, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(1);
    release([]);
    await first;
  });

  it('backs off the unsent chunks when an earlier chunk fails', async () => {
    const many = Array.from(
      { length: MAX_BOUND_LOOKUP_IDS * 2 + 1 },
      (_, i) => `!r${i}:hs`,
    );
    const t = setup(async () => {
      throw new Error('boom');
    });
    await t.refresh(many, 'tok');
    await t.refresh(many, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed chunk from blocking rooms that did succeed', async () => {
    const many = Array.from(
      { length: MAX_BOUND_LOOKUP_IDS + 1 },
      (_, i) => `!r${i}:hs`,
    );
    let calls = 0;
    const t = setup(async () => {
      if (++calls === 2) throw new Error('boom');
      return [];
    });
    await t.refresh(many, 'tok');
    await t.refresh(many, 'tok');
    expect(t.fn).toHaveBeenCalledTimes(2);
  });
});
