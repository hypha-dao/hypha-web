export type SpaceGroupCallVoiceProcessingPreset =
  | 'standard'
  | 'voice_isolation'
  | 'music';

type AudioProcessingConstraints = {
  autoGainControl: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  /**
   * Chrome-only, non-standard OS/platform-level voice isolation (distinct
   * from the standard autoGainControl/echoCancellation/noiseSuppression
   * trio above). Ignored by browsers/platforms that don't support it.
   */
  voiceIsolation: boolean;
};

export function constraintsForVoicePreset(
  preset: SpaceGroupCallVoiceProcessingPreset,
): AudioProcessingConstraints {
  switch (preset) {
    case 'voice_isolation':
      return {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
        voiceIsolation: true,
      };
    case 'music':
      return {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: false,
        voiceIsolation: false,
      };
    case 'standard':
    default:
      return {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: false,
        voiceIsolation: false,
      };
  }
}
