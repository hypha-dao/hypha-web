import type * as MatrixSdk from 'matrix-js-sdk';

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

function firstLiveVideoTrack(
  groupCall: MatrixSdk.GroupCall,
): MediaStreamTrack | null {
  const screen = groupCall.screenshareFeeds
    .map((feed) => feed.stream.getVideoTracks()[0] ?? null)
    .find((track) => track && track.readyState === 'live');
  if (screen) return screen;

  const localVideo =
    groupCall.localCallFeed?.stream.getVideoTracks()[0] ?? null;
  if (localVideo && localVideo.readyState === 'live') return localVideo;

  const remoteVideo = groupCall.userMediaFeeds
    .filter((feed) => !feed.isLocal())
    .map((feed) => feed.stream.getVideoTracks()[0] ?? null)
    .find((track) => track && track.readyState === 'live');
  return remoteVideo ?? null;
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
  return tracks;
}

function createMixedAudioTrack(
  tracks: MediaStreamTrack[],
): { track: MediaStreamTrack; dispose: () => void } | null {
  if (typeof window === 'undefined' || tracks.length === 0) return null;
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  const context = new Ctx();
  const destination = context.createMediaStreamDestination();
  const sources = tracks.map((track) => {
    const sourceStream = new MediaStream([track]);
    const source = context.createMediaStreamSource(sourceStream);
    source.connect(destination);
    return source;
  });
  const mixedTrack = destination.stream.getAudioTracks()[0];
  if (!mixedTrack) {
    sources.forEach((source) => source.disconnect());
    void context.close();
    return null;
  }
  return {
    track: mixedTrack,
    dispose: () => {
      sources.forEach((source) => source.disconnect());
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
  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(output, { mimeType })
      : new MediaRecorder(output);
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
 * Build a call recording from live call feeds. Video is captured by cloning an
 * active feed track so the in-call pipeline is not disturbed.
 */
export async function createCallRecording(
  groupCall: MatrixSdk.GroupCall | null | undefined,
): Promise<CallRecordingControls | null> {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const output = new MediaStream();
  const disposers: Array<() => void> = [];
  const disposeAll = () => {
    for (const dispose of disposers) dispose();
  };

  if (groupCall) {
    const videoTrack = firstLiveVideoTrack(groupCall);
    if (videoTrack) {
      output.addTrack(videoTrack.clone());
    }

    const audioTracks = allLiveAudioTracks(groupCall);
    const mixed = createMixedAudioTrack(audioTracks);
    if (mixed?.track) {
      output.addTrack(mixed.track);
      disposers.push(() => mixed.dispose());
    }
  }

  // Never open a second getUserMedia mic while in a Matrix call — it steals
  // the device from the call and causes video/audio flicker in the UI.
  if (output.getAudioTracks().length === 0 && !groupCall) {
    const mic = await acquireLocalMicStream();
    if (mic?.track) {
      output.addTrack(mic.track);
      disposers.push(mic.dispose);
    }
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
  const output = new MediaStream();
  const videoTrack = firstLiveVideoTrack(groupCall);
  if (videoTrack) output.addTrack(videoTrack.clone());
  const audioTracks = allLiveAudioTracks(groupCall);
  const mixed = createMixedAudioTrack(audioTracks);
  if (mixed?.track) output.addTrack(mixed.track);
  const silentFallback =
    output.getTracks().length === 0 ? createSilentAudioTrack() : null;
  if (silentFallback?.track) output.addTrack(silentFallback.track);

  return startMediaStreamRecording(output, () => {
    mixed?.dispose();
    silentFallback?.dispose();
  });
}

/** Vercel serverless request body limit (~4.5 MB). Upload media to Matrix first. */
const VERCEL_FUNCTION_PAYLOAD_SOFT_LIMIT_BYTES = 4 * 1024 * 1024;

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
  matrixClient,
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
  matrixClient?: MatrixSdk.MatrixClient | null;
}) {
  const resolvedMimeType = mimeType || blob?.type?.trim() || 'video/webm';
  let uploadedMediaUri: string | null = null;

  if (blob && blob.size > 0 && matrixClient) {
    const file = new File([blob], `${callSessionId}.webm`, {
      type: resolvedMimeType,
    });
    try {
      const upload = await matrixClient.uploadContent(file, {
        name: file.name,
        type: resolvedMimeType,
      });
      uploadedMediaUri = upload.content_uri?.trim() || null;
    } catch (error) {
      if (blob.size <= VERCEL_FUNCTION_PAYLOAD_SOFT_LIMIT_BYTES) {
        // Fall back to server relay for small blobs when direct upload fails.
      } else {
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Recording upload to Matrix failed',
        );
      }
    }
  }

  const form = new FormData();
  form.set('room_id', roomId);
  form.set('call_session_id', callSessionId);
  if (uploadedMediaUri) {
    form.set('media_uri', uploadedMediaUri);
    form.set('mime_type', resolvedMimeType);
  } else if (blob && blob.size > 0) {
    form.set('recording', blob, `${callSessionId}.webm`);
    form.set('mime_type', resolvedMimeType);
  }
  if (startedAt) form.set('started_at', startedAt);
  if (endedAt) form.set('ended_at', endedAt);
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
        'Recording is too large for server upload. Try a shorter capture or transcript-only mode.',
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
