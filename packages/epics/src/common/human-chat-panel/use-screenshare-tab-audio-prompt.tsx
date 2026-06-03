'use client';

import { useCallback, useRef, useState, type ReactElement } from 'react';
import type { CallScreenshareSurfaceMode } from '@hypha-platform/core/client';
import { CallScreenshareTabAudioPromptDialog } from './call-screenshare-tab-audio-prompt-dialog';
import {
  markScreenshareTabAudioPromptSeen,
  shouldShowScreenshareTabAudioPrompt,
} from './call-screenshare-tab-audio-prompt';

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

export function useScreenshareTabAudioPrompt({
  isScreensharing,
  remoteScreenshareActive = false,
  setScreensharingEnabled,
  toggleScreensharing,
}: UseScreenshareTabAudioPromptOptions): {
  onStartScreenshare: (mode: CallScreenshareSurfaceMode) => void;
  onStopScreenshare: () => void;
  screenshareTabAudioPromptDialog: ReactElement;
} {
  const [open, setOpen] = useState(false);
  const pendingSurfaceModeRef = useRef<CallScreenshareSurfaceMode>('tab');

  const proceedToShare = useCallback(() => {
    markScreenshareTabAudioPromptSeen();
    setOpen(false);
    void setScreensharingEnabled(true, {
      surfaceMode: pendingSurfaceModeRef.current,
    });
  }, [setScreensharingEnabled]);

  const onStartScreenshare = useCallback(
    (mode: CallScreenshareSurfaceMode) => {
      if (isScreensharing || remoteScreenshareActive) return;
      pendingSurfaceModeRef.current = mode;
      if (shouldShowScreenshareTabAudioPrompt()) {
        setOpen(true);
        return;
      }
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
    screenshareTabAudioPromptDialog: (
      <CallScreenshareTabAudioPromptDialog
        open={open}
        onOpenChange={setOpen}
        onContinue={proceedToShare}
      />
    ),
  };
}
