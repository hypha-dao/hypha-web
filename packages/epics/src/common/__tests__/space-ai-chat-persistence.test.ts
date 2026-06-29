import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  clearSpaceAiChatMessages,
  readSpaceAiChatMessages,
  saveSpaceAiChatMessages,
} from '../space-ai-chat-persistence';

describe('space-ai-chat-persistence', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
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
    });
    vi.stubGlobal('window', { sessionStorage: globalThis.sessionStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists and restores chat messages per space slug', () => {
    saveSpaceAiChatMessages('treetop', [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
    ]);

    expect(readSpaceAiChatMessages('treetop')).toEqual([
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
    ]);
    expect(readSpaceAiChatMessages('other-space')).toBeUndefined();
  });

  it('clears stored messages for a space', () => {
    saveSpaceAiChatMessages('treetop', [
      { id: 'm1', role: 'assistant', parts: [] },
    ]);
    clearSpaceAiChatMessages('treetop');
    expect(readSpaceAiChatMessages('treetop')).toBeUndefined();
  });
});
