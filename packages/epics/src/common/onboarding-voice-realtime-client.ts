'use client';

import { acquireWarmMicStream, isWarmMicStream } from './onboarding-voice-mic';

const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

/** STT-only VAD — Hypha chat (/api/chat) handles tools and MCP, not Realtime. */
export type RealtimeTurnDetectionConfig = {
  type: 'server_vad';
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
  create_response: false;
  /** Hypha cancels TTS client-side on confirmed user transcripts — keep false to avoid noise/echo cuts. */
  interrupt_response: false;
};

export type RealtimeAudioInputConfig = {
  turnDetection: RealtimeTurnDetectionConfig;
  noiseReduction: { type: 'near_field' | 'far_field' } | null;
  transcription: { model: string };
};

/** Match production Live Voice VAD defaults. */
export const DEFAULT_REALTIME_AUDIO_INPUT: RealtimeAudioInputConfig = {
  turnDetection: {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 450,
    create_response: false,
    interrupt_response: false,
  },
  noiseReduction: null,
  transcription: { model: 'gpt-4o-mini-transcribe' },
};

export type RealtimeVoiceSessionPayload = {
  clientSecret: string;
  sessionId: string | null;
  expiresAt: number | null;
  model: string;
  voice: string;
  audioInput: RealtimeAudioInputConfig;
};

export type RealtimeServerEvent = {
  type?: string;
  transcript?: string;
  delta?: string;
  response?: { id?: string; status?: string };
  error?: {
    type?: string;
    code?: string | null;
    message?: string;
  };
  [key: string]: unknown;
};

export type RealtimeErrorInfo = {
  code?: string | null;
  message?: string;
};

export function extractRealtimeErrorInfo(
  event: RealtimeServerEvent,
): RealtimeErrorInfo | null {
  if (
    event.type !== 'error' ||
    !event.error ||
    typeof event.error !== 'object'
  ) {
    return null;
  }
  return {
    code: event.error.code ?? undefined,
    message: event.error.message,
  };
}

/** OpenAI emits these when cancel races completion — safe to ignore. */
export function isIgnorableRealtimeError(error: RealtimeErrorInfo): boolean {
  if (error.code === 'response_cancel_not_active') return true;
  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('no active response') ||
    message.includes('cancellation failed')
  );
}

export function cancelActiveRealtimeResponse(
  connection: RealtimeVoiceConnection | null,
  responseId: string | null | undefined,
): void {
  if (!connection || !responseId?.trim()) return;
  connection.sendEvent({
    type: 'response.cancel',
    response_id: responseId.trim(),
  });
}

export function clearRealtimeOutputAudioBuffer(
  connection: RealtimeVoiceConnection | null,
): void {
  connection?.sendEvent({ type: 'output_audio_buffer.clear' });
}

export class RealtimeVoiceSessionRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RealtimeVoiceSessionRequestError';
    this.status = status;
  }
}

export type RealtimeVoiceConnection = {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  localStream: MediaStream;
  remoteAudio: HTMLAudioElement;
  sendEvent: (event: Record<string, unknown>) => void;
  close: () => void;
};

const REALTIME_SPEAK_TEXT_MAX_CHARS = 4000;

function buildRealtimeSpeakInstructions(text: string): string {
  return [
    'You are a voice output relay only. Do not call tools or add new information.',
    'Speak the following assistant reply aloud in a warm, natural conversational tone.',
    'Do not add, remove, or change words. Do not ask follow-up questions.',
    '',
    text,
  ].join('\n');
}

const NOISE_FILLER_TOKEN_PATTERNS = [
  /^u+h+$/,
  /^u+m+$/,
  /^h+m+$/,
  /^a+h+$/,
  /^o+h+$/,
  /^m+$/,
  /^m+h+m+$/,
  /^e+h+$/,
  /^e+r+$/,
] as const;

function isNoiseFillerToken(token: string): boolean {
  const letters = token.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return true;
  return NOISE_FILLER_TOKEN_PATTERNS.some((pattern) => pattern.test(letters));
}

function isNoiseOnlyTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^[.,\s]+$/.test(trimmed)) return true;
  const tokens = trimmed.split(/[\s.,]+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every(isNoiseFillerToken);
}

/** Ignore VAD false positives — barge-in and /api/chat only on real user speech. */
export function isSubstantiveUserTranscript(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length < 2) return false;
  if (isNoiseOnlyTranscript(normalized)) return false;
  return /\p{L}/u.test(normalized);
}

export function setLocalMicEnabled(
  connection: RealtimeVoiceConnection | null,
  enabled: boolean,
): void {
  if (!connection) return;
  for (const track of connection.localStream.getAudioTracks()) {
    track.enabled = enabled;
  }
}

/** Drop buffered mic audio so ambient noise cannot start a turn during assistant speech. */
export function clearRealtimeInputAudioBuffer(
  connection: RealtimeVoiceConnection | null,
): void {
  connection?.sendEvent({ type: 'input_audio_buffer.clear' });
}

export function setRealtimeRemoteAudioMuted(
  connection: RealtimeVoiceConnection,
  muted: boolean,
): void {
  connection.remoteAudio.muted = muted;
  connection.remoteAudio.volume = muted ? 0 : 1;
}

/** Play assistant chat text through the Realtime voice (WebRTC audio), not browser TTS. */
export function speakAssistantTextViaRealtime(
  connection: RealtimeVoiceConnection,
  text: string,
  options?: { activeResponseId?: string | null },
): boolean {
  const speakable = text.trim().slice(0, REALTIME_SPEAK_TEXT_MAX_CHARS);
  if (!speakable || connection.dataChannel.readyState !== 'open') {
    return false;
  }

  const instructions = buildRealtimeSpeakInstructions(speakable);

  cancelActiveRealtimeResponse(connection, options?.activeResponseId);

  connection.sendEvent({
    type: 'response.create',
    response: {
      conversation: 'none',
      output_modalities: ['audio'],
      instructions,
      metadata: { purpose: 'hypha_assistant_speak' },
    },
  });

  setRealtimeRemoteAudioMuted(connection, false);
  void connection.remoteAudio.play().catch(() => {
    // Autoplay may be blocked until user gesture; WebRTC track usually still plays.
  });

  return true;
}

export async function fetchRealtimeVoiceSession(params: {
  authToken: string;
  conversationContext: Record<string, unknown>;
  locale?: string;
  recentTranscriptSummary?: string;
}): Promise<RealtimeVoiceSessionPayload> {
  const response = await fetch('/api/voice/realtime/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.authToken}`,
    },
    body: JSON.stringify({
      conversationContext: params.conversationContext,
      locale: params.locale,
      recentTranscriptSummary: params.recentTranscriptSummary,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    clientSecret?: string;
    sessionId?: string | null;
    expiresAt?: number | null;
    model?: string;
    voice?: string;
    audioInput?: RealtimeAudioInputConfig;
  };

  if (!response.ok) {
    throw new RealtimeVoiceSessionRequestError(
      response.status,
      payload.message ?? 'Could not start voice Realtime session.',
    );
  }

  if (!payload.clientSecret?.trim()) {
    throw new RealtimeVoiceSessionRequestError(
      response.status,
      'Voice Realtime session response did not include credentials.',
    );
  }

  return {
    clientSecret: payload.clientSecret.trim(),
    sessionId: payload.sessionId ?? null,
    expiresAt: payload.expiresAt ?? null,
    model: payload.model ?? '',
    voice: payload.voice ?? '',
    audioInput: payload.audioInput ?? DEFAULT_REALTIME_AUDIO_INPUT,
  };
}

export async function connectOpenAiRealtimeCall(params: {
  clientSecret: string;
  audioInput?: RealtimeAudioInputConfig;
  onEvent: (event: RealtimeServerEvent) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}): Promise<RealtimeVoiceConnection> {
  if (typeof window === 'undefined') {
    throw new Error('Realtime voice is only available in the browser.');
  }
  if (!window.isSecureContext) {
    throw new Error('Microphone access requires a secure context (HTTPS).');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone capture is not supported in this browser.');
  }

  const peerConnection = new RTCPeerConnection();
  const remoteAudio = document.createElement('audio');
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute('playsinline', 'true');
  remoteAudio.muted = true;
  remoteAudio.volume = 0;
  remoteAudio.style.display = 'none';
  document.body?.appendChild(remoteAudio);

  peerConnection.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      remoteAudio.srcObject = stream;
    }
  };

  if (params.onConnectionStateChange) {
    peerConnection.onconnectionstatechange = () => {
      params.onConnectionStateChange?.(peerConnection.connectionState);
    };
  }

  const warmStream = await acquireWarmMicStream();
  const localStream =
    warmStream ??
    (await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }));
  const usesWarmMic = isWarmMicStream(localStream);
  for (const track of localStream.getTracks()) {
    peerConnection.addTrack(track, localStream);
  }

  const dataChannel = peerConnection.createDataChannel('oai-events');
  dataChannel.onmessage = (messageEvent) => {
    try {
      const parsed = JSON.parse(
        String(messageEvent.data),
      ) as RealtimeServerEvent;
      params.onEvent(parsed);
    } catch {
      // ignore malformed events
    }
  };

  const sendEvent = (event: Record<string, unknown>) => {
    if (dataChannel.readyState !== 'open') return;
    dataChannel.send(JSON.stringify(event));
  };

  const audioInput = params.audioInput ?? DEFAULT_REALTIME_AUDIO_INPUT;

  dataChannel.addEventListener('open', () => {
    sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
        audio: {
          input: {
            transcription: audioInput.transcription,
            turn_detection: audioInput.turnDetection,
            ...(audioInput.noiseReduction
              ? { noise_reduction: audioInput.noiseReduction }
              : {}),
          },
        },
      },
    });
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const sdpResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
    method: 'POST',
    body: offer.sdp ?? '',
    headers: {
      Authorization: `Bearer ${params.clientSecret}`,
      'Content-Type': 'application/sdp',
    },
  });

  if (!sdpResponse.ok) {
    const detail = await sdpResponse.text().catch(() => '');
    throw new Error(
      `OpenAI Realtime call failed (${sdpResponse.status}).${
        detail ? ` ${detail.slice(0, 180)}` : ''
      }`,
    );
  }

  const answerSdp = await sdpResponse.text();
  await peerConnection.setRemoteDescription({
    type: 'answer',
    sdp: answerSdp,
  });

  const close = () => {
    try {
      dataChannel.close();
    } catch {
      // ignore
    }
    try {
      peerConnection.close();
    } catch {
      // ignore
    }
    if (!usesWarmMic) {
      for (const track of localStream.getTracks()) {
        track.stop();
      }
    }
    remoteAudio.srcObject = null;
    remoteAudio.remove();
  };

  return {
    peerConnection,
    dataChannel,
    localStream,
    remoteAudio,
    sendEvent,
    close,
  };
}
