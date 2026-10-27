import { afterEach, describe, expect, it } from 'vitest';
import { resolveSpeechVoice } from '../speech-voice';

describe('resolveSpeechVoice', () => {
  const previous = process.env.OPENAI_REALTIME_VOICE;

  afterEach(() => {
    if (previous === undefined) delete process.env.OPENAI_REALTIME_VOICE;
    else process.env.OPENAI_REALTIME_VOICE = previous;
  });

  it('keeps the realtime voice when speech synthesis can use it', () => {
    expect(resolveSpeechVoice('Cedar')).toBe('cedar');
  });

  it('falls back to marin for a voice the speech model cannot speak', () => {
    delete process.env.OPENAI_REALTIME_VOICE;
    expect(resolveSpeechVoice('not-a-voice')).toBe('marin');
  });

  it('uses the configured realtime voice when none is passed', () => {
    process.env.OPENAI_REALTIME_VOICE = 'sage';
    expect(resolveSpeechVoice()).toBe('sage');
  });
});
