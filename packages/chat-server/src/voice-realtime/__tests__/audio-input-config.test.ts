import { afterEach, describe, expect, it } from 'vitest';

import { resolveRealtimeAudioInputConfig } from '../audio-input-config';

describe('resolveRealtimeAudioInputConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses stricter defaults for noisy environments', () => {
    delete process.env.OPENAI_REALTIME_VAD_THRESHOLD;
    delete process.env.OPENAI_REALTIME_VAD_SILENCE_MS;
    delete process.env.OPENAI_REALTIME_NOISE_REDUCTION;

    const config = resolveRealtimeAudioInputConfig('gpt-4o-mini-transcribe');

    expect(config.turnDetection.threshold).toBe(0.72);
    expect(config.turnDetection.silence_duration_ms).toBe(700);
    expect(config.noiseReduction.type).toBe('near_field');
    expect(config.transcription.model).toBe('gpt-4o-mini-transcribe');
  });

  it('reads optional env overrides', () => {
    process.env.OPENAI_REALTIME_VAD_THRESHOLD = '0.8';
    process.env.OPENAI_REALTIME_VAD_SILENCE_MS = '900';
    process.env.OPENAI_REALTIME_NOISE_REDUCTION = 'far_field';

    const config = resolveRealtimeAudioInputConfig('gpt-4o-mini-transcribe');

    expect(config.turnDetection.threshold).toBe(0.8);
    expect(config.turnDetection.silence_duration_ms).toBe(900);
    expect(config.noiseReduction.type).toBe('far_field');
  });
});
