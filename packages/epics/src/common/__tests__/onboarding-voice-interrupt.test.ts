import { describe, expect, it } from 'vitest';

import {
  GRACEFUL_INTERRUPT_MIN_SPEECH_MS,
  hasClearInterruptIntentFromTranscript,
  hasSustainedInterruptSpeech,
  isLikelyNoiseTranscript,
  shouldGracefullyInterruptAssistant,
} from '../onboarding-voice-interrupt';

describe('onboarding-voice-interrupt', () => {
  it('treats fillers as noise', () => {
    expect(isLikelyNoiseTranscript('um')).toBe(true);
    expect(isLikelyNoiseTranscript('euh')).toBe(true);
    expect(isLikelyNoiseTranscript('oui')).toBe(true);
  });

  it('detects clear interrupt intent from substantive speech', () => {
    expect(hasClearInterruptIntentFromTranscript('wait stop')).toBe(true);
    expect(
      hasClearInterruptIntentFromTranscript('blindspot dans lespace'),
    ).toBe(true);
    expect(hasClearInterruptIntentFromTranscript('um')).toBe(false);
  });

  it('requires sustained speech before timing-based interrupt', () => {
    const startedAt = 1_000;
    expect(hasSustainedInterruptSpeech(startedAt, startedAt + 400)).toBe(false);
    expect(
      hasSustainedInterruptSpeech(
        startedAt,
        startedAt + GRACEFUL_INTERRUPT_MIN_SPEECH_MS,
      ),
    ).toBe(true);
  });

  it('interrupts assistant playback when intent is clear', () => {
    expect(
      shouldGracefullyInterruptAssistant({
        phase: 'speaking',
        isChatStreaming: false,
        sendInFlight: false,
        assistantSpeechActive: true,
        speechStartedAt: null,
        transcript: 'actually I meant the governance blind spot',
      }),
    ).toBe(true);

    expect(
      shouldGracefullyInterruptAssistant({
        phase: 'listening',
        isChatStreaming: false,
        sendInFlight: false,
        assistantSpeechActive: false,
        speechStartedAt: null,
        transcript: 'hello there',
      }),
    ).toBe(false);
  });
});
