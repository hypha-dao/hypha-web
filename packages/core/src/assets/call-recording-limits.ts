import {
  CALL_RECORDING_AUDIO_BITS_PER_SECOND,
  CALL_RECORDING_DURATION_CRITICAL_RATIO,
  CALL_RECORDING_DURATION_WARN_RATIO,
  CALL_RECORDING_MAX_FILE_SIZE_BYTES,
  CALL_RECORDING_SIZE_CRITICAL_RATIO,
  CALL_RECORDING_SIZE_WARN_RATIO,
  CALL_RECORDING_TARGET_DURATION_SECONDS,
  CALL_RECORDING_VIDEO_BITS_PER_SECOND,
} from './call-recording-constants';

export type CallRecordingCaptureWarning = {
  code: CallRecordingLimitWarningCode;
  remainingMinutes: number;
  remainingSizeMb: number;
};

export type CallRecordingLimitWarningCode =
  | 'duration_warn'
  | 'duration_critical'
  | 'size_warn'
  | 'size_critical';

export type CallRecordingLimitLevel = 'ok' | 'warn' | 'critical';

export type CallRecordingCaptureLimitEvaluation = {
  level: CallRecordingLimitLevel;
  warningCode: CallRecordingLimitWarningCode | null;
  estimatedBytes: number;
  elapsedSeconds: number;
  remainingDurationSeconds: number;
  remainingBytes: number;
};

export function estimateCallRecordingBytes(
  elapsedSeconds: number,
  hasVideo: boolean,
): number {
  const safeSeconds = Math.max(0, elapsedSeconds);
  const audioBytes =
    (CALL_RECORDING_AUDIO_BITS_PER_SECOND * safeSeconds) / 8;
  const videoBytes = hasVideo
    ? (CALL_RECORDING_VIDEO_BITS_PER_SECOND * safeSeconds) / 8
    : 0;
  return Math.round((audioBytes + videoBytes) * 1.1);
}

function levelRank(level: CallRecordingLimitLevel): number {
  if (level === 'critical') return 2;
  if (level === 'warn') return 1;
  return 0;
}

export function evaluateCallRecordingCaptureLimits(params: {
  elapsedSeconds: number;
  hasVideo: boolean;
}): CallRecordingCaptureLimitEvaluation {
  const elapsedSeconds = Math.max(0, params.elapsedSeconds);
  const estimatedBytes = estimateCallRecordingBytes(
    elapsedSeconds,
    params.hasVideo,
  );
  const remainingDurationSeconds = Math.max(
    0,
    CALL_RECORDING_TARGET_DURATION_SECONDS - elapsedSeconds,
  );
  const remainingBytes = Math.max(
    0,
    CALL_RECORDING_MAX_FILE_SIZE_BYTES - estimatedBytes,
  );

  const durationRatio =
    elapsedSeconds / CALL_RECORDING_TARGET_DURATION_SECONDS;
  const sizeRatio = estimatedBytes / CALL_RECORDING_MAX_FILE_SIZE_BYTES;

  let level: CallRecordingLimitLevel = 'ok';
  let warningCode: CallRecordingLimitWarningCode | null = null;

  const consider = (
    candidateLevel: CallRecordingLimitLevel,
    candidateCode: CallRecordingLimitWarningCode,
  ) => {
    if (levelRank(candidateLevel) >= levelRank(level)) {
      level = candidateLevel;
      warningCode = candidateCode;
    }
  };

  if (durationRatio >= CALL_RECORDING_DURATION_CRITICAL_RATIO) {
    consider('critical', 'duration_critical');
  } else if (durationRatio >= CALL_RECORDING_DURATION_WARN_RATIO) {
    consider('warn', 'duration_warn');
  }

  if (sizeRatio >= CALL_RECORDING_SIZE_CRITICAL_RATIO) {
    consider('critical', 'size_critical');
  } else if (sizeRatio >= CALL_RECORDING_SIZE_WARN_RATIO) {
    consider('warn', 'size_warn');
  }

  return {
    level,
    warningCode,
    estimatedBytes,
    elapsedSeconds,
    remainingDurationSeconds,
    remainingBytes,
  };
}
