import type * as MatrixSdk from 'matrix-js-sdk';
import { GroupCallEvent } from 'matrix-js-sdk';
import type { CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';

import { uploadCallRecordingBlob } from '../../../assets/client/upload-call-recording';
import { sleepMs } from '../../../assets/client/call-recording-local-backup';

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function resolveSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export type CallTranscriptChunk = {
  speakerLabel: string;
  text: string;
  timestampMs: number;
};

export function formatSpeakerLabeledTranscript(
  chunks: CallTranscriptChunk[],
): string {
  if (chunks.length === 0) return '';
  const lines: string[] = [];
  let currentSpeaker: string | null = null;
  let currentText = '';
  for (const chunk of chunks) {
    const speaker = chunk.speakerLabel.trim() || 'Speaker';
    const text = chunk.text.trim();
    if (!text) continue;
    if (speaker === currentSpeaker) {
      currentText = currentText ? `${currentText} ${text}` : text;
    } else {
      if (currentSpeaker && currentText) {
        lines.push(`${currentSpeaker}: ${currentText}`);
      }
      currentSpeaker = speaker;
      currentText = text;
    }
  }
  if (currentSpeaker && currentText) {
    lines.push(`${currentSpeaker}: ${currentText}`);
  }
  return lines.join('\n');
}

export function startBrowserCallTranscription(options?: {
  language?: string;
  onError?: (message: string) => void;
  resolveSpeakerLabel?: () => string;
}) {
  const SpeechRecognition = resolveSpeechRecognitionCtor();
  if (!SpeechRecognition) {
    return {
      supported: false as const,
      pause: async () => {},
      resume: () => {},
      stop: () => '',
    };
  }

  const chunks: CallTranscriptChunk[] = [];
  let stopped = false;
  let paused = false;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = options?.language?.trim() || 'en-US';
  const handleResult = (event: unknown) => {
    try {
      const e = event as {
        resultIndex?: number;
        results?: ArrayLike<{
          0?: { transcript?: string };
          isFinal?: boolean;
        }>;
      };
      const list = e.results;
      if (!list) return;
      const start =
        typeof e.resultIndex === 'number' && e.resultIndex >= 0
          ? e.resultIndex
          : 0;
      for (let i = start; i < list.length; i += 1) {
        const result = list[i];
        if (!result?.isFinal) continue;
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) continue;
        const speakerLabel =
          options?.resolveSpeakerLabel?.().trim() || 'Speaker';
        chunks.push({
          speakerLabel,
          text: transcript,
          timestampMs: Date.now(),
        });
      }
    } catch {
      // ignore malformed browser event payloads
    }
  };
  recognition.onresult = handleResult;
  recognition.onerror = (event) => {
    const message =
      (event as { error?: string })?.error ?? 'speech-recognition-error';
    options?.onError?.(message);
  };

  const stopRecognition = () =>
    new Promise<void>((resolve) => {
      let settled = false;
      const previousOnEnd = recognition.onend;
      const finalize = () => {
        if (settled) return;
        settled = true;
        if (recognition.onend === onEndWrapper) {
          recognition.onend = previousOnEnd;
        }
        resolve();
      };
      const onEndWrapper: NonNullable<
        SpeechRecognitionInstance['onend']
      > = () => {
        previousOnEnd?.();
        finalize();
      };
      recognition.onend = onEndWrapper;
      try {
        recognition.stop();
      } catch {
        finalize();
        return;
      }
      setTimeout(finalize, 1500);
    });

  const startRecognition = () => {
    if (stopped || paused) return;
    try {
      recognition.start();
    } catch {
      // restart best effort; ignore repeated failures
    }
  };

  recognition.onend = () => {
    if (stopped || paused) return;
    startRecognition();
  };

  try {
    startRecognition();
  } catch (error) {
    options?.onError?.(error instanceof Error ? error.message : String(error));
    return {
      supported: false as const,
      pause: async () => {},
      resume: () => {},
      stop: () => '',
    };
  }

  return {
    supported: true as const,
    pause: async () => {
      if (stopped || paused) return;
      paused = true;
      await stopRecognition();
    },
    resume: () => {
      if (stopped || !paused) return;
      paused = false;
      startRecognition();
    },
    stop: async () => {
      if (!stopped) {
        paused = false;
        stopped = true;
        await stopRecognition();
      }
      recognition.onresult = handleResult;
      recognition.onend = null;
      return formatSpeakerLabeledTranscript(chunks);
    },
  };
}

const AUDIO_MIXER_REFRESH_MS = 400;

type CallVideoSourceKind = 'screenshare' | 'camera';

export type CallVideoSource = {
  track: MediaStreamTrack;
  stream: MediaStream;
  kind: CallVideoSourceKind;
};

type CallVideoFeedLike = {
  stream: MediaStream;
  isVideoMuted: () => boolean;
  isLocal?: () => boolean;
};

function isLiveVideoTrack(
  track: MediaStreamTrack | null | undefined,
): track is MediaStreamTrack {
  return Boolean(track && track.readyState === 'live');
}

function liveVideoFromFeed(
  feed: CallVideoFeedLike,
): { track: MediaStreamTrack; stream: MediaStream } | null {
  if (feed.isVideoMuted()) return null;
  const stream = feed.stream;
  const track =
    stream
      .getVideoTracks()
      .find((candidate) => candidate.readyState === 'live') ??
    stream.getVideoTracks()[0];
  if (!isLiveVideoTrack(track)) return null;
  return { track, stream };
}

/** Every screenshare feed, including `localScreenshareFeed` when not yet listed. */
export function iterCallScreenshareFeeds(
  groupCall: MatrixSdk.GroupCall,
): CallFeed[] {
  const out: CallFeed[] = [];
  const seen = new Set<string>();
  const push = (feed: CallFeed | undefined) => {
    if (!feed) return;
    const key = `${feed.userId ?? ''}:${feed.deviceId ?? ''}:${feed.stream.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(feed);
  };
  for (const feed of groupCall.screenshareFeeds) push(feed);
  push(groupCall.localScreenshareFeed);
  return out.sort(
    (a, b) => Number(a.isLocal?.() ?? false) - Number(b.isLocal?.() ?? false),
  );
}

/** Collect every live camera + screenshare track from the active GroupCall. */
export function collectCallVideoSources(
  groupCall: MatrixSdk.GroupCall,
): CallVideoSource[] {
  const out: CallVideoSource[] = [];
  const seen = new Set<string>();

  for (const feed of iterCallScreenshareFeeds(groupCall)) {
    const live = liveVideoFromFeed(feed);
    if (!live || seen.has(live.track.id)) continue;
    seen.add(live.track.id);
    out.push({ ...live, kind: 'screenshare' });
  }

  const localFeed = groupCall.localCallFeed;
  if (localFeed) {
    const live = liveVideoFromFeed(localFeed);
    if (live && !seen.has(live.track.id)) {
      seen.add(live.track.id);
      out.push({ ...live, kind: 'camera' });
    }
  }

  for (const feed of groupCall.userMediaFeeds) {
    const live = liveVideoFromFeed(feed);
    if (!live || seen.has(live.track.id)) continue;
    seen.add(live.track.id);
    out.push({ ...live, kind: 'camera' });
  }

  return out;
}

/** Tile layout for composited call recording (screenshare + participant grid). */
export function layoutCallRecordingTiles(
  sources: CallVideoSource[],
  width: number,
  height: number,
): Array<{
  source: CallVideoSource;
  x: number;
  y: number;
  w: number;
  h: number;
}> {
  if (sources.length === 0) return [];

  const screens = sources.filter((s) => s.kind === 'screenshare');
  const cameras = sources.filter((s) => s.kind === 'camera');

  if (screens.length > 0) {
    const screen = screens[0]!;
    const stripH = cameras.length > 0 ? Math.round(height * 0.28) : 0;
    const mainH = height - stripH;
    const tiles: Array<{
      source: CallVideoSource;
      x: number;
      y: number;
      w: number;
      h: number;
    }> = [{ source: screen, x: 0, y: 0, w: width, h: mainH }];
    if (cameras.length === 0) return tiles;
    const tileW = width / cameras.length;
    cameras.forEach((source, index) => {
      tiles.push({
        source,
        x: Math.round(index * tileW),
        y: mainH,
        w: Math.round(tileW),
        h: stripH,
      });
    });
    return tiles;
  }

  const count = cameras.length;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const tileW = width / cols;
  const tileH = height / rows;

  return cameras.map((source, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      source,
      x: Math.round(col * tileW),
      y: Math.round(row * tileH),
      w: Math.round(tileW),
      h: Math.round(tileH),
    };
  });
}

function drawVideoTile(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: 'cover' | 'contain',
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const scale =
    fit === 'cover' ? Math.max(w / vw, h / vh) : Math.min(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
}

type ResolveGroupCall = () => MatrixSdk.GroupCall | null | undefined;

function normalizeGroupCallResolver(
  groupCallOrResolver:
    | MatrixSdk.GroupCall
    | null
    | undefined
    | ResolveGroupCall,
): ResolveGroupCall {
  if (typeof groupCallOrResolver === 'function') {
    return groupCallOrResolver;
  }
  return () => groupCallOrResolver;
}

/**
 * Canvas compositor that redraws all participant feeds every frame. Keeps recording
 * in video/webm even when the call starts audio-only so camera can be enabled later.
 */
function createCallVideoCompositor(
  resolveGroupCall: ResolveGroupCall,
): { track: MediaStreamTrack; dispose: () => void } | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = CALL_RECORDING_COMPOSITOR_WIDTH;
  canvas.height = CALL_RECORDING_COMPOSITOR_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const videoSink = document.createElement('div');
  videoSink.setAttribute('aria-hidden', 'true');
  videoSink.style.cssText =
    'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;';
  document.body.appendChild(videoSink);

  const videoElements = new Map<string, HTMLVideoElement>();
  let disposed = false;
  let drawTimer: number | null = null;
  const disposers: Array<() => void> = [];

  const bindGroupCallListeners = (groupCall: MatrixSdk.GroupCall) => {
    const onFeedsChanged = () => drawFrame();
    const events = [
      GroupCallEvent.UserMediaFeedsChanged,
      GroupCallEvent.ScreenshareFeedsChanged,
      GroupCallEvent.LocalScreenshareStateChanged,
    ] as const;
    for (const eventName of events) {
      groupCall.on(eventName, onFeedsChanged);
      disposers.push(() => groupCall.off(eventName, onFeedsChanged));
    }
  };

  const ensureVideoElement = (source: CallVideoSource): HTMLVideoElement => {
    let el = videoElements.get(source.track.id);
    if (!el) {
      el = document.createElement('video');
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      el.srcObject = source.stream;
      el.addEventListener('loadedmetadata', () => {
        void el?.play().catch(() => undefined);
      });
      videoSink.appendChild(el);
      void el.play().catch(() => undefined);
      videoElements.set(source.track.id, el);
    } else if (el.srcObject !== source.stream) {
      el.srcObject = source.stream;
      void el.play().catch(() => undefined);
    }
    return el;
  };

  const drawFrame = () => {
    if (disposed) return;
    const groupCall = resolveGroupCall();
    if (!groupCall) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(
      0,
      0,
      CALL_RECORDING_COMPOSITOR_WIDTH,
      CALL_RECORDING_COMPOSITOR_HEIGHT,
    );

    const sources = collectCallVideoSources(groupCall);
    const activeIds = new Set(sources.map((s) => s.track.id));
    for (const [trackId, el] of videoElements) {
      if (activeIds.has(trackId)) continue;
      el.srcObject = null;
      el.remove();
      videoElements.delete(trackId);
    }

    const tiles = layoutCallRecordingTiles(
      sources,
      CALL_RECORDING_COMPOSITOR_WIDTH,
      CALL_RECORDING_COMPOSITOR_HEIGHT,
    );
    for (const tile of tiles) {
      const video = ensureVideoElement(tile.source);
      ctx.save();
      ctx.beginPath();
      ctx.rect(tile.x, tile.y, tile.w, tile.h);
      ctx.clip();
      drawVideoTile(
        ctx,
        video,
        tile.x,
        tile.y,
        tile.w,
        tile.h,
        tile.source.kind === 'screenshare' ? 'contain' : 'cover',
      );
      ctx.restore();
    }
  };

  const initialGroupCall = resolveGroupCall();
  if (initialGroupCall) {
    bindGroupCallListeners(initialGroupCall);
  }

  drawFrame();
  drawTimer = window.setInterval(
    drawFrame,
    Math.round(1000 / CALL_RECORDING_COMPOSITOR_FPS),
  );
  const capture = canvas.captureStream(CALL_RECORDING_COMPOSITOR_FPS);
  const track = capture.getVideoTracks()[0];
  if (!track) {
    if (drawTimer != null) window.clearInterval(drawTimer);
    videoSink.remove();
    return null;
  }

  return {
    track,
    dispose: () => {
      disposed = true;
      if (drawTimer != null) window.clearInterval(drawTimer);
      for (const dispose of disposers) dispose();
      disposers.length = 0;
      for (const el of videoElements.values()) {
        el.srcObject = null;
        el.remove();
      }
      videoElements.clear();
      videoSink.remove();
      track.stop();
    },
  };
}

function allLiveAudioTracks(
  groupCall: MatrixSdk.GroupCall,
): MediaStreamTrack[] {
  const tracks: MediaStreamTrack[] = [];
  const seen = new Set<string>();
  const addFromStream = (stream: MediaStream | undefined) => {
    if (!stream) return;
    for (const track of stream.getAudioTracks()) {
      if (track.readyState !== 'live' || seen.has(track.id)) continue;
      seen.add(track.id);
      tracks.push(track);
    }
  };
  addFromStream(groupCall.localCallFeed?.stream);
  for (const feed of groupCall.userMediaFeeds) {
    addFromStream(feed.stream);
  }
  for (const feed of iterCallScreenshareFeeds(groupCall)) {
    addFromStream(feed.stream);
  }
  return tracks;
}

/**
 * Mix all call audio into one track and re-sync sources when Matrix replaces
 * local/remote streams (camera toggle, voice preset, audio↔video switch).
 */
function createDynamicMixedAudioTrack(getTracks: () => MediaStreamTrack[]): {
  track: MediaStreamTrack;
  refresh: () => void;
  dispose: () => void;
} | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;

  const context = new Ctx();
  const destination = context.createMediaStreamDestination();
  const connected = new Map<string, MediaStreamAudioSourceNode>();

  const refresh = () => {
    const liveIds = new Set<string>();
    for (const track of getTracks()) {
      if (track.readyState !== 'live') continue;
      liveIds.add(track.id);
      if (connected.has(track.id)) continue;
      const sourceStream = new MediaStream([track]);
      const source = context.createMediaStreamSource(sourceStream);
      source.connect(destination);
      connected.set(track.id, source);
    }
    for (const [trackId, source] of connected) {
      if (liveIds.has(trackId)) continue;
      source.disconnect();
      connected.delete(trackId);
    }
  };

  refresh();
  const mixedTrack = destination.stream.getAudioTracks()[0];
  if (!mixedTrack) {
    connected.forEach((source) => source.disconnect());
    void context.close();
    return null;
  }

  return {
    track: mixedTrack,
    refresh,
    dispose: () => {
      connected.forEach((source) => source.disconnect());
      connected.clear();
      mixedTrack.stop();
      void context.close();
    },
  };
}

function createSilentAudioTrack(): {
  track: MediaStreamTrack;
  dispose: () => void;
} | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  const context = new Ctx();
  const destination = context.createMediaStreamDestination();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.00001;
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start();
  const track = destination.stream.getAudioTracks()[0];
  if (!track) {
    oscillator.stop();
    oscillator.disconnect();
    gain.disconnect();
    void context.close();
    return null;
  }
  return {
    track,
    dispose: () => {
      try {
        oscillator.stop();
      } catch {
        // ignore; oscillator may already be stopped
      }
      oscillator.disconnect();
      gain.disconnect();
      track.stop();
      void context.close();
    },
  };
}

function chooseRecorderMimeType(output: MediaStream): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const hasVideo = output.getVideoTracks().length > 0;
  const preferred = hasVideo
    ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
      ]
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return preferred.find((type) => MediaRecorder.isTypeSupported(type));
}

import {
  CALL_RECORDING_AUDIO_BITS_PER_SECOND,
  CALL_RECORDING_COMPOSITOR_FPS,
  CALL_RECORDING_COMPOSITOR_HEIGHT,
  CALL_RECORDING_COMPOSITOR_WIDTH,
  CALL_RECORDING_VIDEO_BITS_PER_SECOND,
} from '../../../assets/call-recording-constants';

type CallRecordingControls = {
  mimeType: string;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<Blob>;
};

function startMediaStreamRecording(
  output: MediaStream,
  dispose: () => void,
): CallRecordingControls | null {
  if (typeof MediaRecorder === 'undefined') {
    dispose();
    return null;
  }
  if (output.getTracks().length === 0) {
    dispose();
    return null;
  }

  const mimeType = chooseRecorderMimeType(output);
  const hasVideo = output.getVideoTracks().length > 0;
  const recorderOptions: MediaRecorderOptions = {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: CALL_RECORDING_AUDIO_BITS_PER_SECOND,
    ...(hasVideo
      ? { videoBitsPerSecond: CALL_RECORDING_VIDEO_BITS_PER_SECOND }
      : {}),
  };
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(output, recorderOptions);
  } catch {
    dispose();
    return null;
  }
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(250);

  const resolvedMimeType = recorder.mimeType || mimeType || 'video/webm';
  return {
    mimeType: resolvedMimeType,
    pause: () => {
      if (recorder.state !== 'recording') return;
      try {
        recorder.pause();
      } catch {
        // ignore pause failures; recorder may be mid-transition
      }
    },
    resume: () => {
      if (recorder.state !== 'paused') return;
      try {
        recorder.resume();
      } catch {
        // ignore resume failures; recorder may be mid-transition
      }
    },
    stop: async () => {
      const buildBlob = () =>
        new Blob(chunks, {
          type: resolvedMimeType,
        });
      const result = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(buildBlob());
        };
        if (recorder.state === 'inactive') {
          resolve(buildBlob());
          return;
        }
        try {
          if (
            typeof recorder.requestData === 'function' &&
            recorder.state === 'recording'
          ) {
            recorder.requestData();
          }
        } catch {
          // best effort — still attempt stop below
        }
        window.setTimeout(() => {
          try {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          } catch {
            resolve(buildBlob());
          }
        }, 300);
      });
      output.getTracks().forEach((track) => track.stop());
      dispose();
      return result;
    },
  };
}

async function acquireLocalMicStream(): Promise<{
  track: MediaStreamTrack;
  dispose: () => void;
} | null> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const track = stream.getAudioTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }
    return {
      track,
      dispose: () => {
        stream.getTracks().forEach((t) => t.stop());
      },
    };
  } catch {
    return null;
  }
}

/**
 * Build a call recording from live call feeds. Video uses a canvas compositor so
 * every participant (and screenshare) is captured; audio is dynamically re-mixed
 * when streams change during camera or call-mode toggles.
 */
function buildGroupCallRecordingStream(
  resolveGroupCall: ResolveGroupCall,
): { stream: MediaStream; dispose: () => void } | null {
  const output = new MediaStream();
  const disposers: Array<() => void> = [];
  const disposeAll = () => {
    for (const dispose of disposers) dispose();
  };

  const compositor = createCallVideoCompositor(resolveGroupCall);
  if (compositor?.track) {
    output.addTrack(compositor.track);
    disposers.push(() => compositor.dispose());
  }

  const mixer = createDynamicMixedAudioTrack(() => {
    const groupCall = resolveGroupCall();
    return groupCall ? allLiveAudioTracks(groupCall) : [];
  });
  if (mixer?.track) {
    output.addTrack(mixer.track);
    disposers.push(() => mixer.dispose());
    const refreshTimer = window.setInterval(
      () => mixer.refresh(),
      AUDIO_MIXER_REFRESH_MS,
    );
    disposers.push(() => window.clearInterval(refreshTimer));
  }

  if (output.getTracks().length === 0) {
    disposeAll();
    return null;
  }

  return { stream: output, dispose: disposeAll };
}

export async function createCallRecording(
  groupCallOrResolver:
    | MatrixSdk.GroupCall
    | null
    | undefined
    | ResolveGroupCall,
): Promise<CallRecordingControls | null> {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const resolveGroupCall = normalizeGroupCallResolver(groupCallOrResolver);
  const groupCall = resolveGroupCall();
  if (groupCall) {
    const built = buildGroupCallRecordingStream(resolveGroupCall);
    if (!built) return null;
    return startMediaStreamRecording(built.stream, built.dispose);
  }

  const output = new MediaStream();
  const disposers: Array<() => void> = [];
  const disposeAll = () => {
    for (const dispose of disposers) dispose();
  };

  // Never open a second getUserMedia mic while in a Matrix call — it steals
  // the device from the call and causes video/audio flicker in the UI.
  const mic = await acquireLocalMicStream();
  if (mic?.track) {
    output.addTrack(mic.track);
    disposers.push(mic.dispose);
  }

  if (output.getAudioTracks().length === 0) {
    const silentFallback = createSilentAudioTrack();
    if (silentFallback?.track) {
      output.addTrack(silentFallback.track);
      disposers.push(() => silentFallback.dispose());
    }
  }

  return startMediaStreamRecording(output, disposeAll);
}

/** Record without Matrix feeds when group call state is unavailable. */
export function startStandaloneCallRecording() {
  if (typeof window === 'undefined') return null;
  const output = new MediaStream();
  const silentFallback = createSilentAudioTrack();
  if (silentFallback?.track) output.addTrack(silentFallback.track);
  return startMediaStreamRecording(output, () => {
    silentFallback?.dispose();
  });
}

export function startGroupCallRecording(groupCall: MatrixSdk.GroupCall) {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }
  const built = buildGroupCallRecordingStream(() => groupCall);
  if (!built) return null;
  return startMediaStreamRecording(built.stream, built.dispose);
}

export async function uploadRecordedCallArtifact({
  authToken,
  spaceSlug,
  roomId,
  callSessionId,
  blob,
  mimeType,
  transcriptText,
  startedAt,
  endedAt,
  launchContext,
}: {
  authToken: string;
  spaceSlug: string;
  roomId: string;
  callSessionId: string;
  blob?: Blob;
  mimeType?: string;
  transcriptText?: string;
  startedAt?: string;
  endedAt?: string;
  launchContext?: {
    signalTitle?: string;
    signalSlug?: string;
    threadRootEventId?: string;
  };
}) {
  const resolvedMimeType = mimeType || blob?.type?.trim() || 'video/webm';
  let uploadedMediaUri: string | null = null;
  let uploadedStorageKey: string | null = null;

  if (blob && blob.size > 0) {
    const uploaded = await uploadCallRecordingBlob({
      blob,
      fileName: `${callSessionId}.webm`,
      mimeType: resolvedMimeType,
      authorizationToken: authToken,
    });
    uploadedMediaUri = uploaded.mediaUri;
    uploadedStorageKey = uploaded.storageKey;
  }

  const form = new FormData();
  form.set('room_id', roomId);
  form.set('call_session_id', callSessionId);
  if (uploadedMediaUri) {
    form.set('media_uri', uploadedMediaUri);
    form.set('mime_type', resolvedMimeType);
    if (uploadedStorageKey) {
      form.set('storage_key', uploadedStorageKey);
    }
  }
  if (startedAt) form.set('started_at', startedAt);
  if (endedAt) form.set('ended_at', endedAt);
  if (launchContext?.signalTitle?.trim()) {
    form.set('signal_title', launchContext.signalTitle.trim());
    form.set('context_title', launchContext.signalTitle.trim());
  }
  if (launchContext?.signalSlug?.trim()) {
    form.set('signal_slug', launchContext.signalSlug.trim());
  }
  if (launchContext?.threadRootEventId?.trim()) {
    form.set('thread_root_event_id', launchContext.threadRootEventId.trim());
  }
  if (transcriptText?.trim())
    form.set('transcript_text', transcriptText.trim());

  const response = await fetch(
    `/api/matrix/call-artifacts/upload?spaceSlug=${encodeURIComponent(
      spaceSlug,
    )}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: form,
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 413) {
      throw new Error(
        'Recording exceeds the maximum upload size (90-minute calls). Try a shorter capture or transcript-only mode.',
      );
    }
    throw new Error(text || `upload failed with status ${response.status}`);
  }
  return (await response.json()) as {
    ok: true;
    media_uri: string | null;
    call_session_id: string;
    transcript_stored: boolean;
    recording_stored: boolean;
  };
}

export const CALL_RECORDING_UPLOAD_MAX_ATTEMPTS = 3;

export async function uploadRecordedCallArtifactWithRetry(
  input: Parameters<typeof uploadRecordedCallArtifact>[0],
): Promise<Awaited<ReturnType<typeof uploadRecordedCallArtifact>>> {
  let lastError: unknown;
  for (
    let attempt = 1;
    attempt <= CALL_RECORDING_UPLOAD_MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      return await uploadRecordedCallArtifact(input);
    } catch (error) {
      lastError = error;
      if (attempt < CALL_RECORDING_UPLOAD_MAX_ATTEMPTS) {
        await sleepMs(1000 * attempt);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'Call recording upload failed'));
}
