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
  interrupt_response: false;
};

export type RealtimeAudioInputConfig = {
  turnDetection: RealtimeTurnDetectionConfig;
  noiseReduction: { type: 'near_field' | 'far_field' };
  transcription: { model: string };
};

/** Fallback when session API omits audioInput (older deployments). */
export const DEFAULT_REALTIME_AUDIO_INPUT: RealtimeAudioInputConfig = {
  turnDetection: {
    type: 'server_vad',
    threshold: 0.72,
    prefix_padding_ms: 300,
    silence_duration_ms: 700,
    create_response: false,
    interrupt_response: false,
  },
  noiseReduction: { type: 'near_field' },
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

function buildRealtimeSpeakInstructions(text: string): string {
  return [
    'You are a voice output relay only. Do not call tools or add new information.',
    'Speak the following assistant reply aloud in a warm, natural conversational tone.',
    'Do not add, remove, or change words. Do not ask follow-up questions.',
    '',
    text,
  ].join('\n');
}

export function setLocalMicEnabled(
  connection: RealtimeVoiceConnection,
  enabled: boolean,
): void {
  for (const track of connection.localStream.getAudioTracks()) {
    track.enabled = enabled;
  }
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
  options?: { cancelActiveResponse?: boolean },
): boolean {
  const speakable = text.trim().slice(0, REALTIME_SPEAK_TEXT_MAX_CHARS);
  if (!speakable || connection.dataChannel.readyState !== 'open') {
    return false;
  }

  const instructions = buildRealtimeSpeakInstructions(speakable);

  if (options?.cancelActiveResponse) {
    connection.sendEvent({ type: 'response.cancel' });
  }
  connection.sendEvent({
    type: 'response.create',
    response: {
      output_modalities: ['audio'],
      instructions,
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
        autoGainControl: false,
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
        audio: {
          input: {
            noise_reduction: audioInput.noiseReduction,
            transcription: audioInput.transcription,
            turn_detection: audioInput.turnDetection,
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
