'use client';

import { useTranslations } from 'next-intl';

import { DropdownMenuItem } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { ComposerGoogleDriveIcon } from './composer-google-drive-icon';
import { useGoogleDrivePicker } from './use-google-drive-picker';

type ComposerAttachGoogleDriveMenuItemProps = {
  onFilesPicked: (files: File[]) => void;
  disabled?: boolean;
  onPickerOpen?: () => void;
  onError?: (message: string) => void;
};

export function ComposerAttachGoogleDriveMenuItem({
  onFilesPicked,
  disabled = false,
  onPickerOpen,
  onError,
}: ComposerAttachGoogleDriveMenuItemProps) {
  const t = useTranslations('HumanChatPanel');
  const { openPicker, configured, available, isOpening } = useGoogleDrivePicker(
    {
      onFilesPicked,
      disabled,
      onError,
    },
  );

  return (
    <DropdownMenuItem
      className={cn(
        'cursor-pointer gap-2',
        (isOpening || !available) && 'opacity-70',
      )}
      disabled={disabled || isOpening || !configured}
      title={
        !configured ? t('composerAttachGoogleDriveUnavailable') : undefined
      }
      onSelect={(event) => {
        event.preventDefault();
        if (!available) return;
        onPickerOpen?.();
        requestAnimationFrame(() => {
          void openPicker();
        });
      }}
    >
      <ComposerGoogleDriveIcon />
      <span>{t('composerAttachGoogleDrive')}</span>
    </DropdownMenuItem>
  );
}
