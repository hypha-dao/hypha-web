'use client';

import {
  acquireWarmMicStream,
  createSilentAudioStream,
  releaseSilentAudioStream,
} from './onboarding-voice-mic';

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

/** Live Voice VAD defaults — keep in sync with chat-server audio-input-config. */
export const DEFAULT_REALTIME_AUDIO_INPUT: RealtimeAudioInputConfig = {
  turnDetection: {
    type: 'server_vad',
    // Lower than room-noise tuning so a quiet "yes" still opens a turn.
    threshold: 0.55,
    prefix_padding_ms: 350,
    // End the turn sooner after a short answer.
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
/** Browser mic failures. These do not clear by retrying off a timer. */
export function microphoneCaptureErrorCode(
  error: unknown,
): 'not-allowed' | 'audio-capture' | null {
  if (!error || typeof error !== 'object') return null;
  const name =
    'name' in error && typeof (error as { name?: unknown }).name === 'string'
      ? (error as { name: string }).name
      : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    message.includes('permission denied') ||
    message.includes('not allowed')
  ) {
    return 'not-allowed';
  }
  if (
    name === 'NotFoundError' ||
    name === 'NotReadableError' ||
    name === 'OverconstrainedError' ||
    message.includes('requested device not found') ||
    message.includes('could not start audio')
  ) {
    return 'audio-capture';
  }
  return null;
}

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
  /** Voice chosen when the session was created. Spoken replies reuse it. */
  voice: string;
  /** The member's microphone, kept while a silent track stands in. */
  liveMicTrack: MediaStreamTrack | null;
  /** The sender from addTrack. Its current track changes, so it cannot be looked up later. */
  micSender: RTCRtpSender | null;
  /** Serializes replaceTrack so an older mute cannot land after a newer unmute. */
  micSwapQueue: Promise<void>;
  sendEvent: (event: Record<string, unknown>) => void;
  close: () => void;
};

const REALTIME_SPEAK_TEXT_MAX_CHARS = 4000;

function buildRealtimeSpeakLanguageDirective(): string {
  return 'Speak the text below in the same language it is written in. Hypha supports only English, Portuguese, Spanish, French, and German—never any other language.';
}

function buildRealtimeSpeakInstructions(text: string): string {
  // Silent ---CHAT_REPLY--- boundary (never say "script" — that word gets
  // announced). Without a marker, Realtime invents lines instead of reading
  // the bubble — including "Request completed" or false token sends.
  return [
    'CRITICAL OVERRIDE FOR THIS RESPONSE ONLY.',
    'Ignore any earlier briefing, space facts, or conversation summary for speech content.',
    'You are a voice output relay only. Do not call tools or add new information.',
    'Read aloud only the chat reply after ---CHAT_REPLY---, verbatim, every word, in order, with a warm natural tone.',
    'Your first spoken word must be the first word after that marker. Never say the marker itself.',
    'Do not announce what you are about to do. Do not paraphrase, summarize, reorder, soften, or skip.',
    'Do not add greetings, fillers, questions, or closings that are not in the chat reply.',
    'If the chat reply is one short sentence, speak only that sentence.',
    'Forbidden spoken words unless they appear after the marker: "request completed", "done", "finished", "okay", "script", "I will read".',
    'Do not invent actions. Never say you sent tokens, transferred funds, approved a proposal, or finished anything for them.',
    'Do not ask follow-up questions. Do not return to a previous signal or topic.',
    buildRealtimeSpeakLanguageDirective(),
    '',
    '---CHAT_REPLY---',
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

/** One-word answers that must reach chat. Not um/uh noise. */
const SHORT_DECISION_TRANSCRIPT =
  /^(?:yes|no|yeah|yep|yup|ok|okay|oui|non|si|sí|ja|nein|sure|nope|nah|pass|later|maybe|sim|não|nao|da|nyet|right|correct|true|false|absolutely|definitely)(?:\s+(?:please|thanks|thank you|bitte|merci|por favor))?[\s.!?,-]*$/i;

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

/** Short yes / no / ok answers are real turns, not ambient blips. */
export function isShortDecisionTranscript(text: string): boolean {
  return SHORT_DECISION_TRANSCRIPT.test(text.trim());
}

/** Ignore VAD false positives — barge-in and /api/chat only on real user speech. */
export function isSubstantiveUserTranscript(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  if (isShortDecisionTranscript(normalized)) return true;
  if (normalized.length < 3) return false;
  if (isNoiseOnlyTranscript(normalized)) return false;
  if (!/\p{L}/u.test(normalized)) return false;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount === 1 && normalized.length < 5) return false;
  return true;
}

let silentMicTrack: MediaStreamTrack | null = null;
let silentMicContext: AudioContext | null = null;

function silentStandInTrack(): MediaStreamTrack | null {
  if (silentMicTrack && silentMicTrack.readyState === 'live') {
    if (silentMicContext?.state === 'suspended') {
      void silentMicContext.resume();
    }
    return silentMicTrack;
  }
  if (typeof AudioContext === 'undefined') return null;
  if (silentMicContext) void silentMicContext.close().catch(() => undefined);
  const context = new AudioContext();
  silentMicContext = context;
  if (context.state === 'suspended') void context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0;
  const destination = context.createMediaStreamDestination();
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start();
  silentMicTrack = destination.stream.getAudioTracks()[0] ?? null;
  return silentMicTrack;
}

function liveMicTrackOf(
  connection: RealtimeVoiceConnection,
): MediaStreamTrack | null {
  const saved = connection.liveMicTrack;
  if (saved && saved.readyState === 'live') return saved;
  return (
    connection.localStream
      .getAudioTracks()
      .find((track) => track.readyState === 'live') ?? null
  );
}

async function ensureLiveMicTrack(
  connection: RealtimeVoiceConnection,
): Promise<MediaStreamTrack | null> {
  const current = liveMicTrackOf(connection);
  if (current) {
    current.enabled = true;
    connection.liveMicTrack = current;
    return current;
  }
  const stream = await acquireWarmMicStream();
  const track =
    stream?.getAudioTracks().find((item) => item.readyState === 'live') ?? null;
  if (!track) return null;
  track.enabled = true;
  connection.liveMicTrack = track;
  if (stream) connection.localStream = stream;
  return track;
}

export function setLocalMicEnabled(
  connection: RealtimeVoiceConnection | null,
  enabled: boolean,
): void {
  if (!connection) return;
  const sender = connection.micSender;
  if (!sender) {
    for (const track of connection.localStream.getAudioTracks()) {
      track.enabled = enabled;
    }
    return;
  }
  // The hardware mic stays enabled. Turning the track off and on again
  // leaves it silent when it is put back on the sender, so the session
  // keeps hearing the stand-in.
  connection.micSwapQueue = connection.micSwapQueue
    .then(async () => {
      if (!enabled) {
        const live = liveMicTrackOf(connection);
        if (live) connection.liveMicTrack = live;
        const silent = silentStandInTrack();
        if (!silent) return;
        await sender.replaceTrack(silent);
        clearRealtimeInputAudioBuffer(connection);
        return;
      }
      const live = await ensureLiveMicTrack(connection);
      if (!live) return;
      await sender.replaceTrack(live);
    })
    .catch(() => undefined);
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

let speechContext: AudioContext | null = null;
/** One spoken line at a time. A second start stops the line already playing. */
let activeExactSpeechStop: (() => void) | null = null;

/** Must match OpenAI `response_format: 'pcm'` (24 kHz mono s16le). */
const SPEECH_PCM_SAMPLE_RATE = 24_000;
/**
 * Buffer ~180ms before the first schedule so the opening syllable is not
 * lost while the AudioContext wakes and the stream fills.
 */
const SPEECH_PCM_FIRST_PLAY_BYTES =
  Math.floor(SPEECH_PCM_SAMPLE_RATE * 0.18) * 2;
/** Schedule ~100ms slices once playback has begun. */
const SPEECH_PCM_SLICE_BYTES = Math.floor(SPEECH_PCM_SAMPLE_RATE * 0.1) * 2;
/** Lead time before the first sample so resume does not swallow the start. */
const SPEECH_PCM_START_DELAY_SEC = 0.12;

/** Resume the speaker during a click so a later recording can play. */
export function unlockExactSpeechPlayback(): void {
  const Context =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Context) return;
  if (!speechContext) speechContext = new Context();
  if (speechContext.state === 'suspended') {
    void speechContext.resume().catch(() => undefined);
  }
}

function pcm16LeToFloat32(bytes: Uint8Array): Float32Array {
  const samples = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

function concatUint8(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.byteLength === 0) return b;
  if (b.byteLength === 0) return a;
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

/** Fetch TTS PCM without playing — used to warm the next sentence while the first finishes. */
export async function prefetchExactSpeechPcm({
  text,
  authToken,
  signal,
}: {
  text: string;
  authToken: string;
  signal?: AbortSignal;
}): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch('/api/voice/speak', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!response.ok || signal?.aborted) return null;
    return response.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Play the chat reply as synthesized speech. The realtime model is not asked
 * to say it: that call generates a new reply, and the words drift.
 * Streams PCM from `/api/voice/speak` so the first samples play before the
 * full clip arrives (avoids waiting on arrayBuffer + decodeAudioData).
 * Pass `pcm` when the bytes were already prefetched for a seamless handoff.
 */
export function startExactSpeechPlayback({
  text,
  authToken,
  pcm,
}: {
  text: string;
  authToken: string;
  pcm?: ArrayBuffer | null;
}): { stop: () => void; done: Promise<boolean> } {
  activeExactSpeechStop?.();
  activeExactSpeechStop = null;
  const abort = new AbortController();
  const liveSources = new Set<AudioBufferSourceNode>();
  let endTimer: number | null = null;
  let settled = false;
  let resolveDone: (spoken: boolean) => void = () => undefined;
  const done = new Promise<boolean>((resolve) => {
    resolveDone = resolve;
  });
  const finish = (spoken: boolean) => {
    if (settled) return;
    settled = true;
    resolveDone(spoken);
  };
  const stop = () => {
    abort.abort();
    if (endTimer !== null) {
      window.clearTimeout(endTimer);
      endTimer = null;
    }
    for (const source of liveSources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already finished.
      }
    }
    liveSources.clear();
    if (activeExactSpeechStop === stop) activeExactSpeechStop = null;
    finish(false);
  };
  activeExactSpeechStop = stop;

  void (async () => {
    try {
      unlockExactSpeechPlayback();
      const context = speechContext;
      if (!context) {
        finish(false);
        return;
      }
      if (context.state === 'suspended') {
        await context.resume();
      }
      if (abort.signal.aborted || context.state !== 'running') {
        finish(false);
        return;
      }

      let body: ReadableStream<Uint8Array> | null = null;
      if (pcm && pcm.byteLength >= 2) {
        body = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(pcm));
            controller.close();
          },
        });
      } else {
        const response = await fetch('/api/voice/speak', {
          method: 'POST',
          signal: abort.signal,
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        });
        if (!response.ok || abort.signal.aborted || !response.body) {
          finish(false);
          return;
        }
        body = response.body;
      }

      const reader = body.getReader();
      let pending = new Uint8Array(0);
      let nextStart = context.currentTime + SPEECH_PCM_START_DELAY_SEC;
      let heardAudio = false;
      let lastSource: AudioBufferSourceNode | null = null;

      const schedulePcm = (pcmBytes: Uint8Array) => {
        if (pcmBytes.byteLength < 2) return;
        const samples = pcm16LeToFloat32(pcmBytes);
        if (samples.length === 0) return;
        const buffer = context.createBuffer(
          1,
          samples.length,
          SPEECH_PCM_SAMPLE_RATE,
        );
        buffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        // First slice needs lead time so resume does not swallow the opening.
        // Later slices only need a tiny cushion when the queue underruns.
        const startAt = Math.max(
          nextStart,
          context.currentTime +
            (heardAudio ? 0.02 : SPEECH_PCM_START_DELAY_SEC),
        );
        source.start(startAt);
        nextStart = startAt + buffer.duration;
        heardAudio = true;
        liveSources.add(source);
        lastSource = source;
        source.onended = () => {
          liveSources.delete(source);
          if (source !== lastSource || abort.signal.aborted) return;
          if (endTimer !== null) {
            window.clearTimeout(endTimer);
            endTimer = null;
          }
          if (activeExactSpeechStop === stop) activeExactSpeechStop = null;
          finish(true);
        };
      };

      const flushPending = (force: boolean) => {
        while (true) {
          const aligned = pending.byteLength - (pending.byteLength % 2);
          if (aligned < 2) return;
          if (!heardAudio) {
            if (!force && aligned < SPEECH_PCM_FIRST_PLAY_BYTES) return;
            const take = force
              ? aligned
              : Math.min(
                  aligned,
                  Math.max(SPEECH_PCM_FIRST_PLAY_BYTES, SPEECH_PCM_SLICE_BYTES),
                );
            const slice = pending.subarray(0, take);
            pending = pending.subarray(take);
            schedulePcm(slice);
            continue;
          }
          if (!force && aligned < SPEECH_PCM_SLICE_BYTES) return;
          const take = force
            ? aligned
            : Math.min(aligned, SPEECH_PCM_SLICE_BYTES);
          const slice = pending.subarray(0, take);
          pending = pending.subarray(take);
          schedulePcm(slice);
          if (!force) return;
        }
      };

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (abort.signal.aborted) {
          void reader.cancel().catch(() => undefined);
          finish(false);
          return;
        }
        if (streamDone) break;
        if (value?.byteLength) {
          pending = concatUint8(pending, value);
          flushPending(false);
        }
      }
      flushPending(true);

      if (!heardAudio) {
        finish(false);
        return;
      }

      // Fallback if onended is delayed or dropped after the last slice.
      const remainingMs = Math.max(
        0,
        Math.ceil((nextStart - context.currentTime) * 1000),
      );
      endTimer = window.setTimeout(() => {
        endTimer = null;
        if (activeExactSpeechStop === stop) activeExactSpeechStop = null;
        finish(true);
      }, remainingMs + 1500);
    } catch {
      finish(false);
    }
  })();

  return { stop, done };
}

/** Play assistant chat text through the Realtime voice (WebRTC audio), not browser TTS. */
export function speakAssistantTextViaRealtime(
  connection: RealtimeVoiceConnection,
  text: string,
  options?: { activeResponseId?: string | null; locale?: string },
): boolean {
  const speakable = text.trim().slice(0, REALTIME_SPEAK_TEXT_MAX_CHARS);
  if (!speakable || connection.dataChannel.readyState !== 'open') {
    return false;
  }

  const instructions = buildRealtimeSpeakInstructions(speakable);
  const voice = connection.voice.trim();

  cancelActiveRealtimeResponse(connection, options?.activeResponseId);

  // Out-of-band replies (conversation "none") never reach the WebRTC speaker.
  // The default conversation is what the remote audio track plays.
  connection.sendEvent({
    type: 'response.create',
    response: {
      output_modalities: ['audio'],
      instructions,
      // Speak-only turn — tools invite meta like "Request completed".
      tool_choice: 'none',
      ...(voice ? { audio: { output: { voice } } } : {}),
      metadata: { purpose: 'hypha_assistant_speak' },
    },
  });

  playRemoteAudio(connection.remoteAudio);

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

function playRemoteAudio(audio: HTMLAudioElement): void {
  audio.muted = false;
  audio.volume = 1;
  void audio.play().catch(() => {
    // Autoplay can wait for a click. The next pointerdown asks again.
  });
}

export async function connectOpenAiRealtimeCall(params: {
  clientSecret: string;
  audioInput?: RealtimeAudioInputConfig;
  /** Spoken back on each reply so the WebRTC track keeps this voice. */
  voice?: string;
  onEvent: (event: RealtimeServerEvent) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  /** Suppress Realtime model audio when assistant replies come from /api/chat. */
  muteRemoteAudio?: boolean;
}): Promise<RealtimeVoiceConnection> {
  if (typeof window === 'undefined') {
    throw new Error('Realtime voice is only available in the browser.');
  }
  if (!window.isSecureContext) {
    throw new Error('Microphone access requires a secure context (HTTPS).');
  }

  const peerConnection = new RTCPeerConnection();
  const remoteAudio = document.createElement('audio');
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute('playsinline', 'true');
  // Start audible. A muted element can stay silent: browsers ignore a later
  // unmute that is not inside the click that allowed the microphone.
  remoteAudio.muted = false;
  remoteAudio.volume = 1;
  remoteAudio.style.display = 'none';
  document.body?.appendChild(remoteAudio);

  peerConnection.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      remoteAudio.srcObject = stream;
    } else if (event.track) {
      remoteAudio.srcObject = new MediaStream([event.track]);
    }
    playRemoteAudio(remoteAudio);
  };

  if (params.onConnectionStateChange) {
    peerConnection.onconnectionstatechange = () => {
      params.onConnectionStateChange?.(peerConnection.connectionState);
    };
  }

  const warmStream = await acquireWarmMicStream();
  let localStream: MediaStream;
  let streamKind: 'warm' | 'owned' | 'silent';
  if (warmStream) {
    localStream = warmStream;
    streamKind = 'warm';
  } else {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is not supported in this browser.');
      }
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamKind = 'owned';
    } catch {
      // Hearing the reply does not depend on a microphone.
      localStream = createSilentAudioStream();
      streamKind = 'silent';
    }
  }
  const releaseCapturedStream = () => {
    if (streamKind === 'silent') {
      releaseSilentAudioStream(localStream);
    } else if (streamKind === 'owned') {
      for (const track of localStream.getTracks()) {
        track.stop();
      }
    }
  };

  try {
    let micSender: RTCRtpSender | null = null;
    for (const track of localStream.getTracks()) {
      const added = peerConnection.addTrack(track, localStream);
      if (track.kind === 'audio') micSender = added;
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

    const voice = params.voice?.trim() ?? '';

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
      releaseCapturedStream();
      remoteAudio.srcObject = null;
      remoteAudio.remove();
    };

    return {
      peerConnection,
      dataChannel,
      localStream,
      remoteAudio,
      voice,
      liveMicTrack: null,
      micSender,
      micSwapQueue: Promise.resolve(),
      sendEvent,
      close,
    };
  } catch (error) {
    releaseCapturedStream();
    try {
      peerConnection.close();
    } catch {
      // ignore
    }
    remoteAudio.srcObject = null;
    remoteAudio.remove();
    throw error;
  }
}
