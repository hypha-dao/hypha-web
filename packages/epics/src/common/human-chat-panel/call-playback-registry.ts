'use client';

const playbackElements = new Set<HTMLMediaElement>();

export function registerCallPlaybackElement(
  element: HTMLMediaElement | null,
): () => void {
  if (!element) return () => undefined;
  playbackElements.add(element);
  return () => {
    playbackElements.delete(element);
  };
}

export async function resumeCallPlayback(): Promise<void> {
  await Promise.all(
    [...playbackElements].map(async (element) => {
      if (!element.srcObject && !element.src) return;
      try {
        await element.play();
      } catch {
        // Browser autoplay policy — keepalive may retry on visibility.
      }
    }),
  );
}

/** Test-only reset for module state between vitest cases. */
export function resetCallPlaybackRegistryForTests(): void {
  playbackElements.clear();
}
