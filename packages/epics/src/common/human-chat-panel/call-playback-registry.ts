'use client';

const playbackElements = new Set<HTMLMediaElement>();

/**
 * Chrome/Edge show a native `<video>` PiP affordance that opens an OS-level
 * floating window — outside Hypha's dock frame. Calls use Document PiP instead;
 * block native video PiP on every registered call feed surface.
 */
export function hardenCallVideoAgainstNativePictureInPicture(
  element: HTMLMediaElement,
): () => void {
  if (!(element instanceof HTMLVideoElement)) {
    return () => undefined;
  }

  element.disablePictureInPicture = true;
  element.setAttribute('disablePictureInPicture', '');
  element.setAttribute('controlsList', 'nodownload noremoteplayback');

  const onEnterNativePip = () => {
    void document.exitPictureInPicture?.().catch(() => undefined);
  };
  element.addEventListener('enterpictureinpicture', onEnterNativePip);

  return () => {
    element.removeEventListener('enterpictureinpicture', onEnterNativePip);
  };
}

export function registerCallPlaybackElement(
  element: HTMLMediaElement | null,
): () => void {
  if (!element) return () => undefined;
  playbackElements.add(element);
  const releaseNativePipGuard =
    hardenCallVideoAgainstNativePictureInPicture(element);
  return () => {
    releaseNativePipGuard();
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
