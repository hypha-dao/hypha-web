import { describe, expect, it } from 'vitest';
import { constraintsForVoicePreset } from '../voice-processing-constraints';
import {
  applyScreenshareTrackContentHints,
  resolveScreenshareVoicePresetPlan,
} from '../screenshare-voice-boost';

describe('constraintsForVoicePreset', () => {
  it('forces autoGainControl while screensharing in voice_isolation mode', () => {
    expect(
      constraintsForVoicePreset('voice_isolation', { isScreensharing: true }),
    ).toMatchObject({
      autoGainControl: true,
      noiseSuppression: true,
    });
  });

  it('keeps voice_isolation defaults when not screensharing', () => {
    expect(constraintsForVoicePreset('voice_isolation')).toMatchObject({
      autoGainControl: false,
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
