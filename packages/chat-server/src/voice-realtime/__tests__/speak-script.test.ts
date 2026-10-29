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

  it('falls back to coral for a voice the speech model cannot speak', () => {
    delete process.env.OPENAI_REALTIME_VOICE;
    expect(resolveSpeechVoice('not-a-voice')).toBe('coral');
  });

  it('uses the configured realtime voice when none is passed', () => {
    process.env.OPENAI_REALTIME_VOICE = 'sage';
    expect(resolveSpeechVoice()).toBe('sage');
  });

  it('keeps the joyful home speaker even when realtime is a low voice', () => {
    process.env.OPENAI_REALTIME_VOICE = 'cedar';
    expect(resolveHomeSpeechVoice()).toBe(HOME_SPEECH_VOICE);
    expect(HOME_SPEECH_VOICE).toBe('coral');
  });

  it('asks for a short cheerful joyful delivery', () => {
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/cheerful/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/joyful/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/warm and close/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/never serious/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/never distant/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/ease into the first word/i);
    expect(HOME_SPEECH_SPEED).toBeGreaterThan(1);
    expect(HOME_SPEECH_SPEED).toBeLessThan(1.2);
  });
});
