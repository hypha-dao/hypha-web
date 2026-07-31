// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  rememberLocalSignalThreadTarget,
  resolveSignalThreadByMatrixRoom,
} from '../resolve-signal-thread-by-matrix-room';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe('resolveSignalThreadByMatrixRoom', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          signalSlug: 'fix-video-audio-calls',
          signalTitle: 'Fix video/audio calls',
          spaceSlug: 'demo-space',
          roomId: '!signal:matrix.org',
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hits the signal API when there is no local room→coherence map', async () => {
    const result = await resolveSignalThreadByMatrixRoom(
      '!signal:matrix.org',
      async () => 'token',
    );

    expect(result).toEqual({
      signalSlug: 'fix-video-audio-calls',
      signalTitle: 'Fix video/audio calls',
      spaceSlug: 'demo-space',
      roomId: '!signal:matrix.org',
    });
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/matrix/rooms/${encodeURIComponent('!signal:matrix.org')}/signal`,
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      }),
    );
  });

  it('returns the local cache without calling the API', async () => {
    rememberLocalSignalThreadTarget({
      roomId: '!cached:matrix.org',
      signalSlug: 'cached-signal',
      signalTitle: 'Cached',
      spaceSlug: 'demo-space',
    });

    const result = await resolveSignalThreadByMatrixRoom(
      '!cached:matrix.org',
      async () => 'token',
    );

    expect(result?.signalSlug).toBe('cached-signal');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('persists a successful API lookup for later opens', async () => {
    await resolveSignalThreadByMatrixRoom('!signal:matrix.org');

    vi.mocked(fetch).mockClear();
    const cached = await resolveSignalThreadByMatrixRoom('!signal:matrix.org');

    expect(cached?.signalTitle).toBe('Fix video/audio calls');
    expect(fetch).not.toHaveBeenCalled();
  });
});
