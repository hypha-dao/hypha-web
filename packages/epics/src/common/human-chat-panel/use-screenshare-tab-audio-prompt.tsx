'use client';

import { useCallback, useState, type ReactElement } from 'react';
import { CallScreenshareTabAudioPromptDialog } from './call-screenshare-tab-audio-prompt-dialog';
import {
  markScreenshareTabAudioPromptSeen,
  shouldShowScreenshareTabAudioPrompt,
} from './call-screenshare-tab-audio-prompt';

type UseScreenshareTabAudioPromptOptions = {
  isScreensharing: boolean;
  setScreensharingEnabled: (enabled: boolean) => void | Promise<void>;
  toggleScreensharing: () => void;
};

export function useScreenshareTabAudioPrompt({
  isScreensharing,
  setScreensharingEnabled,
  toggleScreensharing,
}: UseScreenshareTabAudioPromptOptions): {
  onToggleScreenshare: () => void;
  screenshareTabAudioPromptDialog: ReactElement;
} {
  const [open, setOpen] = useState(false);

  const proceedToShare = useCallback(() => {
    markScreenshareTabAudioPromptSeen();
    setOpen(false);
    void setScreensharingEnabled(true);
  }, [setScreensharingEnabled]);

  const onToggleScreenshare = useCallback(() => {
    if (isScreensharing) {
      toggleScreensharing();
      return;
    }
    if (shouldShowScreenshareTabAudioPrompt()) {
      setOpen(true);
      return;
    }
    toggleScreensharing();
  }, [isScreensharing, toggleScreensharing]);

  return {
    onToggleScreenshare,
    screenshareTabAudioPromptDialog: (
      <CallScreenshareTabAudioPromptDialog
        open={open}
        onOpenChange={setOpen}
        onContinue={proceedToShare}
      />
    ),
  };
}
