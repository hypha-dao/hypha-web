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
      stop: () => '',
    };
  }

  const chunks: string[] = [];
  let stopped = false;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = options?.language?.trim() || 'en-US';
  recognition.onresult = (event) => {
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
  recognition.onerror = (event) => {
    const message =
      (event as { error?: string })?.error ?? 'speech-recognition-error';
    options?.onError?.(message);
  };
  recognition.onend = () => {
    if (stopped) return;
    try {
      recognition.start();
    } catch {
      // restart best effort; ignore repeated failures
    }
  };

  try {
    recognition.start();
  } catch (error) {
    options?.onError?.(error instanceof Error ? error.message : String(error));
    return {
      supported: false as const,
      stop: () => '',
    };
  }

  return {
    supported: true as const,
    stop: () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        // ignore stop races
      }
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
  for (const feed of groupCall.userMediaFeeds) {
    for (const track of feed.stream.getAudioTracks()) {
      if (track.readyState === 'live') tracks.push(track);
    }
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

function chooseRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const preferred = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ];
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
  if (output.getTracks().length === 0) {
    mixed?.dispose();
    return null;
  }

  const mimeType = chooseRecorderMimeType();
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
          recorder.stop();
        } catch {
          resolve(buildBlob());
        }
      });
      output.getTracks().forEach((track) => track.stop());
      mixed?.dispose();
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
  blob: Blob;
  mimeType: string;
  transcriptText?: string;
  startedAt?: string;
  endedAt?: string;
}) {
  const form = new FormData();
  form.set('room_id', roomId);
  form.set('call_session_id', callSessionId);
  form.set('recording', blob, `${callSessionId}.webm`);
  form.set('mime_type', mimeType || 'video/webm');
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
    media_uri: string;
    call_session_id: string;
    transcript_stored: boolean;
  };
}
