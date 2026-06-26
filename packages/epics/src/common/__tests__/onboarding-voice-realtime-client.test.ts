import { describe, expect, it } from 'vitest';

import {
  buildRealtimeSpeakInstructions,
  isSubstantiveUserTranscript,
} from '../onboarding-voice-realtime-client';

describe('buildRealtimeSpeakInstructions', () => {
  it('includes native French pronunciation directive for fr locale', () => {
    const instructions = buildRealtimeSpeakInstructions(
      'Bonjour, comment puis-je vous aider ?',
      'fr',
    );
    expect(instructions).toContain('French (fr-FR)');
    expect(instructions).toContain('native pronunciation');
    expect(instructions).toContain('Bonjour, comment puis-je vous aider ?');
  });

  it('defaults to English locale when none is provided', () => {
    const instructions = buildRealtimeSpeakInstructions('Hello there.');
    expect(instructions).toContain('English (en-US)');
  });
});

describe('isSubstantiveUserTranscript', () => {
  it('accepts normal user phrases', () => {
    expect(isSubstantiveUserTranscript('Bonjour.')).toBe(true);
    expect(
      isSubstantiveUserTranscript("OK, comment est-ce que tu peux m'aider ?"),
    ).toBe(true);
  });

  it('rejects noise and filler transcripts', () => {
    expect(isSubstantiveUserTranscript('')).toBe(false);
    expect(isSubstantiveUserTranscript('uh')).toBe(false);
    expect(isSubstantiveUserTranscript('hmm')).toBe(false);
    expect(isSubstantiveUserTranscript('...')).toBe(false);
  });
});
