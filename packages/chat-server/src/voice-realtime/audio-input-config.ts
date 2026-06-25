export type RealtimeNoiseReductionType = 'near_field' | 'far_field';

export type RealtimeTurnDetectionConfig = {
  type: 'server_vad';
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
  create_response: false;
  interrupt_response: false;
};

export type RealtimeAudioInputConfig = {
  turnDetection: RealtimeTurnDetectionConfig;
  noiseReduction: { type: RealtimeNoiseReductionType };
  transcription: { model: string };
};

const DEFAULT_VAD_THRESHOLD = 0.72;
const DEFAULT_VAD_SILENCE_MS = 700;
const DEFAULT_NOISE_REDUCTION: RealtimeNoiseReductionType = 'near_field';

function clampVadThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VAD_THRESHOLD;
  return Math.min(1, Math.max(0, value));
}

function parseVadSilenceMs(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 200) return DEFAULT_VAD_SILENCE_MS;
  return parsed;
}

function resolveNoiseReductionType(): RealtimeNoiseReductionType {
  const raw = process.env.OPENAI_REALTIME_NOISE_REDUCTION?.trim().toLowerCase();
  if (raw === 'far_field') return 'far_field';
  return DEFAULT_NOISE_REDUCTION;
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
      prefix_padding_ms: 300,
      silence_duration_ms: parseVadSilenceMs(
        process.env.OPENAI_REALTIME_VAD_SILENCE_MS,
      ),
      create_response: false,
      interrupt_response: false,
    },
    noiseReduction: {
      type: resolveNoiseReductionType(),
    },
    transcription: {
      model: transcriptionModel,
    },
  };
}
