import { describe, expect, it } from 'vitest';
import {
  CALL_AUDIO_VOICE_WAVE_ACTIVE_BACKGROUND,
  CALL_AUDIO_VOICE_WAVE_ACTIVE_SHADOW,
  CALL_AUDIO_VOICE_WAVE_IDLE_ON_DARK_SCRIM,
  resolveCallAudioVoiceWaveBarStyle,
} from '../call-audio-voice-wave-styles';

describe('call audio voice wave styles (WCUX-AUDIO-TILE-3–4)', () => {
  it('uses space accent for active bars on dark scrim', () => {
    expect(CALL_AUDIO_VOICE_WAVE_ACTIVE_BACKGROUND).toContain('--space-accent');
    expect(CALL_AUDIO_VOICE_WAVE_ACTIVE_SHADOW).toContain('--space-accent');
    expect(
      resolveCallAudioVoiceWaveBarStyle({
        active: true,
        reduceMotion: false,
        onDarkScrim: true,
      }),
    ).toEqual({
      backgroundColor: CALL_AUDIO_VOICE_WAVE_ACTIVE_BACKGROUND,
      boxShadow: CALL_AUDIO_VOICE_WAVE_ACTIVE_SHADOW,
    });
  });

  it('uses muted space accent for idle bars on dark scrim', () => {
    expect(CALL_AUDIO_VOICE_WAVE_IDLE_ON_DARK_SCRIM).toContain(
      '--space-accent',
    );
    expect(
      resolveCallAudioVoiceWaveBarStyle({
        active: false,
        reduceMotion: false,
        onDarkScrim: true,
      }),
    ).toEqual({
      backgroundColor: CALL_AUDIO_VOICE_WAVE_IDLE_ON_DARK_SCRIM,
    });
  });
});
