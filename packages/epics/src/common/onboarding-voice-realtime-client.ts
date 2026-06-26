'use client';

import { acquireWarmMicStream, isWarmMicStream } from './onboarding-voice-mic';
import { resolveOnboardingSpeechLocale } from './onboarding-voice-locale';

const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

/** STT-only VAD shape — values come from the Realtime session API (server source of truth). */
export type RealtimeTurnDetection = {
  type: 'server_vad';
  threshold: number;
  prefix_padding_ms: number;
  silence_duration_ms: number;
  create_response: boolean;
  interrupt_response: boolean;
};

export type RealtimeVoiceSessionPayload = {
  clientSecret: string;
  sessionId: string | null;
  expiresAt: number | null;
  model: string;
  voice: string;
  transcriptionModel: string;
  turnDetection: RealtimeTurnDetection;
};

export type RealtimeServerEvent = {
  type?: string;
  transcript?: string;
  delta?: string;
  response?: { id?: string; status?: string };
  [key: string]: unknown;
};

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

const LANGUAGE_NAME_BY_APP_LOCALE: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
};

function buildRealtimeSpeakLanguageDirective(locale?: string): string {
  const bcp47 = resolveOnboardingSpeechLocale(locale);
  const code = bcp47.split('-')[0]?.toLowerCase() ?? 'en';
  const languageName = LANGUAGE_NAME_BY_APP_LOCALE[code] ?? code;
  return `Speak in ${languageName} (${bcp47}) with native pronunciation and natural intonation for that language. Do not use an English accent unless the text is English.`;
}

/** Instructions for Realtime audio relay — locale sets spoken language/accent. */
export function buildRealtimeSpeakInstructions(
  text: string,
  locale?: string,
): string {
  return [
    'You are a voice output relay only. Do not call tools or add new information.',
    'Speak the following assistant reply aloud in a warm, natural conversational tone.',
    'Do not add, remove, or change words. Do not ask follow-up questions.',
    buildRealtimeSpeakLanguageDirective(locale),
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

/** Ignore VAD false positives — only forward real user speech to /api/chat. */
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

/** Drop buffered mic audio so TTS echo cannot start a turn during assistant speech. */
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

/** Speak assistant text via Realtime audio (marin). Browser TTS is fallback only. */
export function speakAssistantTextViaRealtime(
  connection: RealtimeVoiceConnection,
  text: string,
  options?: { locale?: string },
): boolean {
  const speakable = text.trim().slice(0, REALTIME_SPEAK_TEXT_MAX_CHARS);
  if (!speakable || connection.dataChannel.readyState !== 'open') {
    return false;
  }

  connection.sendEvent({ type: 'response.cancel' });
  connection.sendEvent({
    type: 'response.create',
    response: {
      conversation: 'none',
      output_modalities: ['audio'],
      instructions: buildRealtimeSpeakInstructions(speakable, options?.locale),
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
    transcriptionModel?: string;
    turnDetection?: RealtimeTurnDetection;
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
    transcriptionModel:
      payload.transcriptionModel?.trim() || 'gpt-4o-mini-transcribe',
    turnDetection: payload.turnDetection ?? {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 450,
      create_response: false,
      interrupt_response: false,
    },
  };
}

export async function connectOpenAiRealtimeCall(params: {
  clientSecret: string;
  transcriptionModel: string;
  turnDetection: RealtimeTurnDetection;
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

  dataChannel.addEventListener('open', () => {
    sendEvent({
      type: 'session.update',
      session: {
        audio: {
          input: {
            transcription: { model: params.transcriptionModel },
            turn_detection: params.turnDetection,
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
