export type RealtimeNoiseReductionType = 'near_field' | 'far_field';

export type RealtimeTurnDetectionConfig = {
  type: 'server_vad';
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
  create_response: false;
  /** Client-side barge-in on confirmed transcripts — avoid server VAD echo/noise cuts. */
  interrupt_response: false;
};

export type RealtimeAudioInputConfig = {
  turnDetection: RealtimeTurnDetectionConfig;
  noiseReduction: { type: RealtimeNoiseReductionType } | null;
  transcription: { model: string };
};

/** Live Voice VAD — tuned for room noise and natural breathing pauses. */
const DEFAULT_VAD_THRESHOLD = 0.72;
const DEFAULT_VAD_SILENCE_MS = 1000;
const DEFAULT_PREFIX_PADDING_MS = 350;

function clampVadThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VAD_THRESHOLD;
  return Math.min(1, Math.max(0, value));
}

function parseVadSilenceMs(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 200) return DEFAULT_VAD_SILENCE_MS;
  return parsed;
}

function resolveNoiseReductionType(): {
  type: RealtimeNoiseReductionType;
} | null {
  const raw = process.env.OPENAI_REALTIME_NOISE_REDUCTION?.trim().toLowerCase();
  if (raw === 'off' || raw === 'none' || raw === 'false') return null;
  if (raw === 'far_field') return { type: 'far_field' };
  if (raw === 'near_field') return { type: 'near_field' };
  return { type: 'near_field' };
}

export function resolveRealtimeAudioInputConfig(
  transcriptionModel: string,
): RealtimeAudioInputConfig {
  const threshold = clampVadThreshold(
    Number.parseFloat(process.env.OPENAI_REALTIME_VAD_THRESHOLD ?? ''),
  );

  return {
    turnDetection: {
      type: 'server_vad',
      threshold,
      prefix_padding_ms: DEFAULT_PREFIX_PADDING_MS,
      silence_duration_ms: parseVadSilenceMs(
        process.env.OPENAI_REALTIME_VAD_SILENCE_MS,
      ),
      create_response: false,
      interrupt_response: false,
    },
    noiseReduction: resolveNoiseReductionType(),
    transcription: {
      model: transcriptionModel,
    },
  };
}
