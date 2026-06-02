import type { SpaceGroupCallVoiceProcessingPreset } from './voice-processing-constraints';

export type ScreenshareVoicePresetPlan = {
  effectivePreset: SpaceGroupCallVoiceProcessingPreset;
  restorePreset: SpaceGroupCallVoiceProcessingPreset | null;
};

/** WCUX-SHARE-VOICE-1: auto voice_isolation while presenting from standard preset. */
export function resolveScreenshareVoicePresetPlan(
  currentPreset: SpaceGroupCallVoiceProcessingPreset,
): ScreenshareVoicePresetPlan {
  if (currentPreset === 'standard') {
    return {
      effectivePreset: 'voice_isolation',
      restorePreset: 'standard',
    };
  }
  return {
    effectivePreset: currentPreset,
    restorePreset: null,
  };
}

/** WCUX-SHARE-VOICE-3: content hints for mic speech vs tab audio music. */
export function applyScreenshareTrackContentHints(args: {
  micTrack?: MediaStreamTrack | null;
  screenshareStream?: MediaStream | null;
}): void {
  const { micTrack, screenshareStream } = args;
  if (micTrack && 'contentHint' in micTrack) {
    try {
      micTrack.contentHint = 'speech';
    } catch {
      // unsupported in this browser
    }
  }
  for (const track of screenshareStream?.getAudioTracks() ?? []) {
    if (!('contentHint' in track)) continue;
    try {
      track.contentHint = 'music';
    } catch {
      // unsupported in this browser
    }
  }
}
