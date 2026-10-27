import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveHomeSpeechVoice,
  resolveSpeechVoice,
  SPEECH_TONE_INSTRUCTIONS,
} from '../speech-voice';

describe('resolveSpeechVoice', () => {
  const previous = process.env.OPENAI_REALTIME_VOICE;

  afterEach(() => {
    if (previous === undefined) delete process.env.OPENAI_REALTIME_VOICE;
    else process.env.OPENAI_REALTIME_VOICE = previous;
  });

  it('keeps the realtime voice when speech synthesis can use it', () => {
    expect(resolveSpeechVoice('Cedar')).toBe('cedar');
  });

  it('falls back to shimmer for a voice the speech model cannot speak', () => {
    delete process.env.OPENAI_REALTIME_VOICE;
    expect(resolveSpeechVoice('not-a-voice')).toBe('shimmer');
  });

  it('uses the configured realtime voice when none is passed', () => {
    process.env.OPENAI_REALTIME_VOICE = 'sage';
    expect(resolveSpeechVoice()).toBe('sage');
  });

  it('keeps the home speaker light even when realtime is a low voice', () => {
    process.env.OPENAI_REALTIME_VOICE = 'cedar';
    expect(resolveHomeSpeechVoice()).toBe('shimmer');
  });

  it('asks the speaker for a light voice at an easy pace', () => {
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/light, bright voice/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/not a deep voice/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/everyday pace/i);
    expect(SPEECH_TONE_INSTRUCTIONS).not.toMatch(/pause between sentences/i);
  });
});
