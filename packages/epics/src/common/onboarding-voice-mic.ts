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
        autoGainControl: false,
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
