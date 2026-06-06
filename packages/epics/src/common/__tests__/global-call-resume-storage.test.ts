// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCallDismissedByUser,
  clearCallResumeSnapshot,
  isCallDismissedByUser,
  markCallDismissedByUser,
  persistCallResumeSnapshot,
  readCallResumeSnapshot,
  shouldPersistCallResumeSnapshot,
} from '../global-call-resume-storage';

const ROOM = '!room:example.org';

function installStorageMocks() {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => {
      local.set(key, value);
    },
    removeItem: (key: string) => {
      local.delete(key);
    },
    clear: () => local.clear(),
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => {
      session.set(key, value);
    },
    removeItem: (key: string) => {
      session.delete(key);
    },
    clear: () => session.clear(),
  });
}

beforeEach(() => {
  installStorageMocks();
});

afterEach(() => {
  clearCallResumeSnapshot();
  clearCallDismissedByUser();
  vi.unstubAllGlobals();
});

describe('global-call-resume-storage', () => {
  it('does not read resume snapshot after user dismissed that room', () => {
    persistCallResumeSnapshot({
      version: 1,
      roomId: ROOM,
      spaceSlug: 'hypha',
      callKind: 'video',
      dockMode: 'thumbnail',
      updatedAt: Date.now(),
    });
    markCallDismissedByUser(ROOM);

    expect(readCallResumeSnapshot()).toBeNull();
    expect(readCallResumeSnapshot()).toBeNull();
  });

  it('does not persist resume snapshot while room is dismissed', () => {
    markCallDismissedByUser(ROOM);
    persistCallResumeSnapshot({
      version: 1,
      roomId: ROOM,
      spaceSlug: 'hypha',
      callKind: 'video',
      dockMode: 'thumbnail',
      updatedAt: Date.now(),
    });

    expect(readCallResumeSnapshot()).toBeNull();
    expect(shouldPersistCallResumeSnapshot(ROOM)).toBe(false);
  });

  it('allows resume again after dismiss marker is cleared', () => {
    markCallDismissedByUser(ROOM);
    clearCallDismissedByUser();
    persistCallResumeSnapshot({
      version: 1,
      roomId: ROOM,
      spaceSlug: null,
      callKind: 'audio',
      dockMode: 'expanded',
      updatedAt: Date.now(),
    });

    expect(readCallResumeSnapshot()?.callKind).toBe('audio');
    expect(isCallDismissedByUser(ROOM)).toBe(false);
  });

  it('dismiss marker is scoped to room id', () => {
    markCallDismissedByUser(ROOM);
    expect(isCallDismissedByUser('!other:example.org')).toBe(false);
    expect(isCallDismissedByUser(ROOM)).toBe(true);
  });
});
