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

  it('falls back to coral for a voice the speech model cannot speak', () => {
    delete process.env.OPENAI_REALTIME_VOICE;
    expect(resolveSpeechVoice('not-a-voice')).toBe('coral');
  });

  it('uses the configured realtime voice when none is passed', () => {
    process.env.OPENAI_REALTIME_VOICE = 'sage';
    expect(resolveSpeechVoice()).toBe('sage');
  });

  it('keeps the home speaker feminine even when realtime is a low voice', () => {
    process.env.OPENAI_REALTIME_VOICE = 'cedar';
    expect(resolveHomeSpeechVoice()).toBe('coral');
  });

  it('asks the speaker for a lively feminine voice at an easy pace', () => {
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/woman talking with a friend/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/lively/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/feminine/i);
    expect(SPEECH_TONE_INSTRUCTIONS).toMatch(/everyday pace/i);
    expect(SPEECH_TONE_INSTRUCTIONS).not.toMatch(/pause between sentences/i);
    expect(SPEECH_TONE_INSTRUCTIONS).not.toMatch(/higher than a narrator/i);
  });
});
