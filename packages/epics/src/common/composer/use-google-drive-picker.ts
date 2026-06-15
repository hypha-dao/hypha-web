'use client';

import { useCallback, useState } from 'react';

import {
  isGoogleDrivePickerConfigured,
  pickGoogleDriveFiles,
} from './google-drive-picker';

type UseGoogleDrivePickerOptions = {
  onFilesPicked: (files: File[]) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

export function useGoogleDrivePicker({
  onFilesPicked,
  onError,
  disabled = false,
}: UseGoogleDrivePickerOptions) {
  const [isOpening, setIsOpening] = useState(false);
  const enabled = isGoogleDrivePickerConfigured() && !disabled;

  const openPicker = useCallback(async () => {
    if (!enabled || isOpening) return;
    setIsOpening(true);
    try {
      const files = await pickGoogleDriveFiles();
      if (files.length > 0) {
        onFilesPicked(files);
      }
    } catch (error) {
      const code =
        error instanceof Error ? error.message : 'google_drive_unknown_error';
      if (code !== 'google_drive_not_configured') {
        onError?.(code);
      }
    } finally {
      setIsOpening(false);
    }
  }, [enabled, isOpening, onError, onFilesPicked]);

  return { openPicker, enabled, isOpening };
}
