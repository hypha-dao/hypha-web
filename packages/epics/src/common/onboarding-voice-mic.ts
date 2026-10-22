'use client';

/** Keep one mic stream open while Live Voice is active — avoids cold-start drops. */
let warmMicStream: MediaStream | null = null;
let warmMicPromise: Promise<MediaStream | null> | null = null;

export async function acquireWarmMicStream(): Promise<MediaStream | null> {
  if (typeof window === 'undefined') return null;
  if (!window.isSecureContext) return null;
  if (!navigator.mediaDevices?.getUserMedia) return null;

  if (warmMicStream?.active) {
    return warmMicStream;
  }

  if (warmMicPromise) {
    return warmMicPromise;
  }

  warmMicPromise = navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    .then((stream) => {
      warmMicStream = stream;
      return stream;
    })
    .catch(() => null)
    .finally(() => {
      warmMicPromise = null;
    });

  return warmMicPromise;
}

export function releaseWarmMicStream(): void {
  if (warmMicStream) {
    for (const track of warmMicStream.getTracks()) {
      track.stop();
    }
    warmMicStream = null;
  }
  warmMicPromise = null;
}

export function isWarmMicStream(
  stream: MediaStream | null | undefined,
): boolean {
  return Boolean(stream && warmMicStream === stream);
}

const silentAudioContexts = new WeakMap<MediaStream, AudioContext>();

/** A muted track so the live voice can speak when the microphone is unavailable. */
export function createSilentAudioStream(): MediaStream {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0;
  const destination = context.createMediaStreamDestination();
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start();
  const stream = destination.stream;
  silentAudioContexts.set(stream, context);
  return stream;
}

export function resumeSilentAudioStream(
  stream: MediaStream | null | undefined,
): void {
  if (!stream) return;
  const context = silentAudioContexts.get(stream);
  if (context?.state === 'suspended') {
    void context.resume();
  }
}

export function releaseSilentAudioStream(
  stream: MediaStream | null | undefined,
): void {
  if (!stream || !silentAudioContexts.has(stream)) return;
  const context = silentAudioContexts.get(stream);
  silentAudioContexts.delete(stream);
  for (const track of stream.getTracks()) {
    track.stop();
  }
  void context?.close();
}
