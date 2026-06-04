import { describe, expect, it } from 'vitest';
import {
  markScreenshareTabAudioPromptSeen,
  shouldShowScreenshareTabAudioPrompt,
} from '../call-screenshare-tab-audio-prompt';

describe('call-screenshare-tab-audio-prompt', () => {
  it('does not gate share behind a Hypha dialog (browser picker opens directly)', () => {
    expect(shouldShowScreenshareTabAudioPrompt()).toBe(false);
    markScreenshareTabAudioPromptSeen();
    expect(shouldShowScreenshareTabAudioPrompt()).toBe(false);
  });
});
