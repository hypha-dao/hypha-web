import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseSignalFeedLayout,
  readStoredSignalFeedLayout,
  writeStoredSignalFeedLayout,
} from '../signal-feed-layout';

function installMemoryStorage() {
  const memory = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  vi.stubGlobal('window', { localStorage });
}

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signal feed layout', () => {
  it('accepts only list and cards', () => {
    expect(parseSignalFeedLayout('list')).toBe('list');
    expect(parseSignalFeedLayout('cards')).toBe('cards');
    expect(parseSignalFeedLayout('board')).toBeNull();
    expect(parseSignalFeedLayout(null)).toBeNull();
  });

  it('remembers the latest selection', () => {
    expect(readStoredSignalFeedLayout()).toBe('list');
    writeStoredSignalFeedLayout('cards');
    expect(readStoredSignalFeedLayout()).toBe('cards');
    writeStoredSignalFeedLayout('list');
    expect(readStoredSignalFeedLayout()).toBe('list');
  });
});
