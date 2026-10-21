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

  it('keeps the onboarding card that belongs under the reply', () => {
    writeHomeThread([
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Drop a pin on the map below.' },
          {
            type: 'tool-onboarding_guidance',
            state: 'output-available',
            output: {
              ok: true,
              next_field: 'space_location',
              requires_location_picker: true,
              search_results: [{ name: 'too big to keep' }],
            },
          },
        ],
      } as never,
    ]);

    const [message] = readHomeThread();
    const guidance = message?.parts?.find(
      (part) => part.type === 'tool-onboarding_guidance',
    ) as
      | {
          output?: {
            requires_location_picker?: boolean;
            search_results?: unknown;
          };
        }
      | undefined;
    expect(guidance?.output?.requires_location_picker).toBe(true);
    expect(guidance?.output?.search_results).toBeUndefined();
  });

  it('carries a return across sessions and only once', () => {
    rememberHomeAction('proposal:garden', 'Garden proposal');
    window.sessionStorage.clear();

    expect(consumeHomeReturn()).toBe('Garden proposal');
    expect(consumeHomeReturn()).toBeNull();
  });
});
