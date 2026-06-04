'use client';

import { useCallback, type ReactElement } from 'react';
import type { CallScreenshareSurfaceMode } from '@hypha-platform/core/client';

type SetScreensharingEnabled = (
  enabled: boolean,
  options?: { surfaceMode?: CallScreenshareSurfaceMode },
) => void | Promise<void>;

type UseScreenshareTabAudioPromptOptions = {
  isScreensharing: boolean;
  remoteScreenshareActive?: boolean;
  setScreensharingEnabled: SetScreensharingEnabled;
  toggleScreensharing: () => void;
};

/**
 * Opens the browser `getDisplayMedia` picker immediately for every share mode.
 * Audio defaults (`systemAudio: 'include'`) are applied in {@link withEnhancedScreenshareCapture}.
 */
export function useScreenshareTabAudioPrompt({
  isScreensharing,
  remoteScreenshareActive = false,
  setScreensharingEnabled,
  toggleScreensharing,
}: UseScreenshareTabAudioPromptOptions): {
  onStartScreenshare: (mode: CallScreenshareSurfaceMode) => void;
  onStopScreenshare: () => void;
  screenshareTabAudioPromptDialog: ReactElement | null;
} {
  const onStartScreenshare = useCallback(
    (mode: CallScreenshareSurfaceMode) => {
      if (isScreensharing || remoteScreenshareActive) return;
      void setScreensharingEnabled(true, { surfaceMode: mode });
    },
    [isScreensharing, remoteScreenshareActive, setScreensharingEnabled],
  );

  const onStopScreenshare = useCallback(() => {
    toggleScreensharing();
  }, [toggleScreensharing]);

  return {
    onStartScreenshare,
    onStopScreenshare,
    screenshareTabAudioPromptDialog: null,
  };
}
