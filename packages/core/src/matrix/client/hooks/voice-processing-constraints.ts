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
  options?: { isScreensharing?: boolean },
): AudioProcessingConstraints {
  let base: AudioProcessingConstraints;
  switch (preset) {
    case 'voice_isolation':
      base = {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
      };
      break;
    case 'music':
      base = {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: false,
      };
      break;
    case 'standard':
    default:
      base = {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      };
      break;
  }
  if (options?.isScreensharing) {
    return { ...base, autoGainControl: true };
  }
  return base;
}
