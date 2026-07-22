import { describe, expect, it } from 'vitest';
import { constraintsForVoicePreset } from '../voice-processing-constraints';
import {
  applyScreenshareTrackContentHints,
  resolveScreenshareVoicePresetPlan,
} from '../screenshare-voice-boost';

describe('constraintsForVoicePreset', () => {
  it('returns standard preset constraints', () => {
    expect(constraintsForVoicePreset('standard')).toEqual({
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: false,
      voiceIsolation: false,
    });
  });

  it('returns voice_isolation preset constraints', () => {
    expect(constraintsForVoicePreset('voice_isolation')).toEqual({
      autoGainControl: false,
      echoCancellation: true,
      noiseSuppression: true,
      voiceIsolation: true,
    });
  });

  it('returns music preset constraints', () => {
    expect(constraintsForVoicePreset('music')).toEqual({
      autoGainControl: false,
      echoCancellation: true,
      noiseSuppression: false,
      voiceIsolation: false,
    });
  });
});

describe('resolveScreenshareVoicePresetPlan', () => {
  it('switches standard to voice_isolation with restore', () => {
    expect(resolveScreenshareVoicePresetPlan('standard')).toEqual({
      effectivePreset: 'voice_isolation',
      restorePreset: 'standard',
    });
  });

  it('keeps explicit music preset without restore', () => {
    expect(resolveScreenshareVoicePresetPlan('music')).toEqual({
      effectivePreset: 'music',
      restorePreset: null,
    });
  });
});

describe('applyScreenshareTrackContentHints (WCUX-SHARE-VOICE-3, row 4)', () => {
  it('sets speech hint on mic and music hint on tab audio tracks', () => {
    const micTrack = { contentHint: '' } as MediaStreamTrack;
    const tabAudioTrack = { contentHint: '' } as MediaStreamTrack;
    const screenshareStream = {
      getAudioTracks: () => [tabAudioTrack],
    } as MediaStream;

    applyScreenshareTrackContentHints({ micTrack, screenshareStream });

    expect(micTrack.contentHint).toBe('speech');
    expect(tabAudioTrack.contentHint).toBe('music');
  });
});
