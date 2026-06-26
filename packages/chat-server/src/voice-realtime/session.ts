import 'server-only';

import { createHash } from 'node:crypto';

import { buildOnboardingRealtimeInstructions } from '../system-prompt';
import { buildSpaceAdvisorRealtimeInstructions } from '../system-prompt';
import type { RealtimeVoiceSessionRequest } from './request-schema';
import { assertVoiceDiscoverySessionContext } from './request-schema';
import {
  resolveRealtimeAudioInputConfig,
  type RealtimeAudioInputConfig,
} from './audio-input-config';

export const MISSING_OPENAI_KEY_MESSAGE =
  'Hypha voice Realtime is not configured: OPENAI_API_KEY is missing.';

const DEFAULT_OPENAI_REALTIME_MODEL = 'gpt-realtime';
const DEFAULT_OPENAI_REALTIME_VOICE = 'marin';
const DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';

export type RealtimeVoiceSessionResult = {
  clientSecret: string;
  sessionId: string | null;
  expiresAt: number | null;
  model: string;
  voice: string;
  audioInput: RealtimeAudioInputConfig;
};

export type RealtimeVoiceSessionErrorCode =
  | 'missing_api_key'
  | 'upstream_error'
  | 'invalid_response';

export class RealtimeVoiceSessionError extends Error {
  readonly code: RealtimeVoiceSessionErrorCode;

  constructor(code: RealtimeVoiceSessionErrorCode, message: string) {
    super(message);
    this.name = 'RealtimeVoiceSessionError';
    this.code = code;
  }
}

function resolveOpenAiRealtimeModel(): string {
  return (
    process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_OPENAI_REALTIME_MODEL
  );
}

function resolveOpenAiRealtimeVoice(): string {
  return (
    process.env.OPENAI_REALTIME_VOICE?.trim() || DEFAULT_OPENAI_REALTIME_VOICE
  );
}

function resolveOpenAiRealtimeTranscriptionModel(): string {
  return (
    process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim() ||
    DEFAULT_OPENAI_REALTIME_TRANSCRIPTION_MODEL
  );
}

function hashSafetyIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

type OpenAiClientSecretResponse = {
  value?: string;
  expires_at?: number;
  session?: {
    id?: string;
  };
};

export async function createRealtimeVoiceSession(
  payload: RealtimeVoiceSessionRequest,
  options?: { safetyUserId?: string },
): Promise<RealtimeVoiceSessionResult> {
  assertVoiceDiscoverySessionContext(payload.conversationContext);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new RealtimeVoiceSessionError(
      'missing_api_key',
      MISSING_OPENAI_KEY_MESSAGE,
    );
  }

  const model = resolveOpenAiRealtimeModel();
  const voice = resolveOpenAiRealtimeVoice();
  const transcriptionModel = resolveOpenAiRealtimeTranscriptionModel();
  const audioInput = resolveRealtimeAudioInputConfig(transcriptionModel);
  const locale =
    payload.locale?.trim() ||
    payload.conversationContext.locale?.trim() ||
    'en';

  const instructions =
    payload.conversationContext.mode === 'space_advisor'
      ? buildSpaceAdvisorRealtimeInstructions({
          spaceSlug: payload.conversationContext.spaceSlug,
          locale,
          recentTranscriptSummary: payload.recentTranscriptSummary,
        })
      : buildOnboardingRealtimeInstructions({
          setupPhase: payload.conversationContext.setupPhase,
          locale,
          recentTranscriptSummary: payload.recentTranscriptSummary,
        });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const safetyUserId = options?.safetyUserId?.trim();
  if (safetyUserId) {
    headers['OpenAI-Safety-Identifier'] = hashSafetyIdentifier(safetyUserId);
  }

  const response = await fetch(
    'https://api.openai.com/v1/realtime/client_secrets',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model,
          instructions,
          audio: {
            input: {
              transcription: audioInput.transcription,
              turn_detection: audioInput.turnDetection,
              ...(audioInput.noiseReduction
                ? { noise_reduction: audioInput.noiseReduction }
                : {}),
            },
            output: {
              voice,
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new RealtimeVoiceSessionError(
      'upstream_error',
      `OpenAI Realtime client secret request failed (${response.status}).${
        detail ? ` ${detail.slice(0, 240)}` : ''
      }`,
    );
  }

  let data: OpenAiClientSecretResponse;
  try {
    data = (await response.json()) as OpenAiClientSecretResponse;
  } catch {
    throw new RealtimeVoiceSessionError(
      'invalid_response',
      'OpenAI Realtime client secret response was not valid JSON.',
    );
  }

  const clientSecret = data.value?.trim();
  if (!clientSecret) {
    throw new RealtimeVoiceSessionError(
      'invalid_response',
      'OpenAI Realtime client secret response did not include a value.',
    );
  }

  return {
    clientSecret,
    sessionId: data.session?.id ?? null,
    expiresAt: typeof data.expires_at === 'number' ? data.expires_at : null,
    model,
    voice,
    audioInput,
  };
}
