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
};

export function ComposerAttachGoogleDriveMenuItem({
  onFilesPicked,
  disabled = false,
  onPickerOpen,
}: ComposerAttachGoogleDriveMenuItemProps) {
  const t = useTranslations('HumanChatPanel');
  const { openPicker, enabled, isOpening } = useGoogleDrivePicker({
    onFilesPicked,
    disabled,
  });

  if (!enabled) {
    return null;
  }

  return (
    <DropdownMenuItem
      className={cn('cursor-pointer gap-2', isOpening && 'opacity-70')}
      disabled={disabled || isOpening}
      onSelect={(event) => {
        event.preventDefault();
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
