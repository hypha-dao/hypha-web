import { describe, expect, it, vi } from 'vitest';
import { constraintsForVoicePreset } from '../voice-processing-constraints';
import * as screenshareVoiceBoost from '../screenshare-voice-boost';

const { applyScreenshareTrackContentHints } = screenshareVoiceBoost;

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

describe('screenshare keeps the mic setup unchanged (#2564)', () => {
  it('exposes no preset switching for screenshare', () => {
    expect(Object.keys(screenshareVoiceBoost)).toEqual([
      'applyScreenshareTrackContentHints',
    ]);
  });

  it('leaves mic constraints untouched when applying content hints', () => {
    const applyConstraints = vi.fn();
    const micTrack = {
      contentHint: '',
      applyConstraints,
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;

    applyScreenshareTrackContentHints({ micTrack, screenshareStream: null });

    expect(applyConstraints).not.toHaveBeenCalled();
    expect(micTrack.stop).not.toHaveBeenCalled();
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
