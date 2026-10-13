import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bindHomePerson,
  consumeHomeReturn,
  readHomeThread,
  rememberHomeAction,
  writeHomeThread,
} from '../member-home-resume';

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('home thread resume', () => {
  beforeEach(() => {
    bindHomePerson('alex');
    const local = memoryStorage();
    const session = memoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('window', {
      localStorage: local,
      sessionStorage: session,
      dispatchEvent: () => true,
    });
  });

  afterEach(() => {
    bindHomePerson('');
    vi.unstubAllGlobals();
  });

  it('moves the open-tab thread into the lasting store', () => {
    window.sessionStorage.setItem(
      'hypha-member-home-thread',
      JSON.stringify([
        {
          id: 's1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Still here.' }],
        },
      ]),
    );

    expect(readHomeThread().map((message) => message.id)).toEqual(['s1']);
    window.sessionStorage.clear();
    expect(readHomeThread().map((message) => message.id)).toEqual(['s1']);
  });

  it('keeps the thread after the tab session is gone', () => {
    writeHomeThread([
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Vote on the garden proposal.' }],
      },
    ]);
    window.sessionStorage.clear();

    expect(readHomeThread().map((message) => message.id)).toEqual(['a1']);
  });

  it('does not show another member the same thread', () => {
    writeHomeThread([
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hello Alex.' }],
      },
    ]);
    bindHomePerson('kate');

    expect(readHomeThread()).toEqual([]);
  });

  it('carries a return across sessions and only once', () => {
    rememberHomeAction('proposal:garden', 'Garden proposal');
    window.sessionStorage.clear();

    expect(consumeHomeReturn()).toBe('Garden proposal');
    expect(consumeHomeReturn()).toBeNull();
  });
});
