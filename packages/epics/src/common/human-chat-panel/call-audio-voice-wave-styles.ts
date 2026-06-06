/** WCUX-AUDIO-TILE-3: active speaking bars on dark scrim. */
export const CALL_AUDIO_VOICE_WAVE_ACTIVE_BACKGROUND =
  'color-mix(in srgb, var(--space-accent, var(--color-accent-9)) 88%, white)';

export const CALL_AUDIO_VOICE_WAVE_ACTIVE_SHADOW =
  '0 0 10px color-mix(in srgb, var(--space-accent, var(--color-accent-9)) 35%, transparent)';

/** WCUX-AUDIO-TILE-4: idle bars on dark scrim. */
export const CALL_AUDIO_VOICE_WAVE_IDLE_ON_DARK_SCRIM =
  'color-mix(in srgb, var(--space-accent, var(--color-accent-9)) 25%, transparent)';

export function resolveCallAudioVoiceWaveBarStyle(args: {
  active: boolean;
  reduceMotion: boolean;
  onDarkScrim: boolean;
}): { backgroundColor?: string; boxShadow?: string } {
  if (!args.active || args.reduceMotion) {
    if (args.onDarkScrim) {
      return { backgroundColor: CALL_AUDIO_VOICE_WAVE_IDLE_ON_DARK_SCRIM };
    }
    return {};
  }
  if (!args.onDarkScrim) {
    return { backgroundColor: CALL_AUDIO_VOICE_WAVE_ACTIVE_BACKGROUND };
  }
  return {
    backgroundColor: CALL_AUDIO_VOICE_WAVE_ACTIVE_BACKGROUND,
    boxShadow: CALL_AUDIO_VOICE_WAVE_ACTIVE_SHADOW,
  };
}
