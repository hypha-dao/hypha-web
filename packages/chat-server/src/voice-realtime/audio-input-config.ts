/** Shared Realtime STT/VAD config — server session mint and client session.update must match. */
export const OPENAI_REALTIME_TURN_DETECTION = {
  type: 'server_vad',
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 450,
  create_response: false,
  interrupt_response: false,
} as const;

export type OpenAiRealtimeTurnDetection = typeof OPENAI_REALTIME_TURN_DETECTION;

export const DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL =
  'gpt-4o-mini-transcribe';
