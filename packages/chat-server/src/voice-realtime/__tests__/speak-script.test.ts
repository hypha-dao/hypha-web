import { afterEach, describe, expect, it } from 'vitest';
import {
  HOME_SPEECH_SPEED,
  HOME_SPEECH_VOICE,
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

  it('falls back to marin for a voice the speech model cannot speak', () => {
    delete process.env.OPENAI_REALTIME_VOICE;
    expect(resolveSpeechVoice('not-a-voice')).toBe('marin');
  });

  it('uses the configured realtime voice when none is passed', () => {
    process.env.OPENAI_REALTIME_VOICE = 'sage';
    expect(resolveSpeechVoice()).toBe('sage');
  });

  it('keeps the LIVE marin home speaker even when realtime is a low voice', () => {
    process.env.OPENAI_REALTIME_VOICE = 'cedar';
    expect(resolveHomeSpeechVoice()).toBe(HOME_SPEECH_VOICE);
    expect(HOME_SPEECH_VOICE).toBe('marin');
  });

  it('keeps fallback TTS aligned with LIVE warm natural delivery', () => {
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/warm natural tone/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/verbatim/i);
    expect(HOME_SPEECH_SPEED).toBe(1);
  });
});
