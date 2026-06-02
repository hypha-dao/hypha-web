import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  markScreenshareTabAudioPromptSeen,
  shouldShowScreenshareTabAudioPrompt,
} from '../call-screenshare-tab-audio-prompt';

describe('call-screenshare-tab-audio-prompt', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        clear: () => {
          store.clear();
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the prompt until marked seen for the session', () => {
    expect(shouldShowScreenshareTabAudioPrompt()).toBe(true);
    markScreenshareTabAudioPromptSeen();
    expect(shouldShowScreenshareTabAudioPrompt()).toBe(false);
  });
});
