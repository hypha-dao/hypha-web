import { describe, expect, it } from 'vitest';
import { constraintsForVoicePreset } from '../voice-processing-constraints';
import { resolveScreenshareVoicePresetPlan } from '../screenshare-voice-boost';

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
