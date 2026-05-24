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

export function startBrowserCallTranscription(options?: {
  language?: string;
  onError?: (message: string) => void;
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

  const chunks: string[] = [];
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
        if (transcript) chunks.push(transcript);
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
      return chunks.join(' ').trim();
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
  if (output.getTracks().length === 0) {
    mixed?.dispose();
    silentFallback?.dispose();
    return null;
  }

  const mimeType = chooseRecorderMimeType(output);
  const recorder = mimeType
    ? new MediaRecorder(output, { mimeType })
    : new MediaRecorder(output);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(1000);

  return {
    mimeType: recorder.mimeType || mimeType || 'video/webm',
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
          type: recorder.mimeType || mimeType || 'video/webm',
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
        try {
          recorder.stop();
        } catch {
          resolve(buildBlob());
        }
      });
      output.getTracks().forEach((track) => track.stop());
      mixed?.dispose();
      silentFallback?.dispose();
      return result;
    },
  };
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
}) {
  const form = new FormData();
  form.set('room_id', roomId);
  form.set('call_session_id', callSessionId);
  if (blob && blob.size > 0) {
    form.set('recording', blob, `${callSessionId}.webm`);
    form.set('mime_type', mimeType || 'video/webm');
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
