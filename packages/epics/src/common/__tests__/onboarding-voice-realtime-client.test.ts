import { describe, expect, it } from 'vitest';

import { isSubstantiveUserTranscript } from '../onboarding-voice-realtime-client';

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
