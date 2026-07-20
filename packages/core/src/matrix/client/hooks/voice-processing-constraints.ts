export type SpaceGroupCallVoiceProcessingPreset =
  | 'standard'
  | 'voice_isolation'
  | 'music';

type AudioProcessingConstraints = {
  autoGainControl: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
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
      };
    case 'music':
      return {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: false,
      };
    case 'standard':
    default:
      return {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: false,
      };
  }
}
