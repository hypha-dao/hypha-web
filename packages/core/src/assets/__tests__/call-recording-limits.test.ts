import { describe, expect, it } from 'vitest';

import { CALL_RECORDING_TARGET_DURATION_SECONDS } from '../call-recording-constants';
import {
  estimateCallRecordingBytes,
  evaluateCallRecordingCaptureLimits,
} from '../call-recording-limits';

describe('evaluateCallRecordingCaptureLimits', () => {
  it('warns before the 90-minute duration limit', () => {
    const elapsedSeconds = Math.floor(
      CALL_RECORDING_TARGET_DURATION_SECONDS * 0.82,
    );
    const evaluation = evaluateCallRecordingCaptureLimits({
      elapsedSeconds,
      hasVideo: false,
    });
    expect(evaluation.level).toBe('warn');
    expect(evaluation.warningCode).toBe('duration_warn');
  });

  it('escalates near the duration limit', () => {
    const elapsedSeconds = Math.floor(
      CALL_RECORDING_TARGET_DURATION_SECONDS * 0.92,
    );
    const evaluation = evaluateCallRecordingCaptureLimits({
      elapsedSeconds,
      hasVideo: false,
    });
    expect(evaluation.level).toBe('critical');
    expect(evaluation.warningCode).toBe('duration_critical');
  });

  it('estimates smaller audio-only captures', () => {
    const oneHour = 60 * 60;
    const audioOnly = estimateCallRecordingBytes(oneHour, false);
    const withVideo = estimateCallRecordingBytes(oneHour, true);
    expect(audioOnly).toBeLessThan(withVideo);
  });
});
