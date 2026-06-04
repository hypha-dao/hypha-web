'use client';

import { Monitor, MonitorOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CallScreenshareSurfaceMode } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

type HumanChatPanelCallScreenshareMenuProps = {
  isScreensharing: boolean;
  disabled?: boolean;
  /** Another participant is presenting — only one share at a time. */
  remoteScreenshareActive?: boolean;
  onStartScreenshare: (mode: CallScreenshareSurfaceMode) => void;
  onStopScreenshare: () => void;
  triggerClassName?: string;
  iconClassName?: string;
  activeTriggerClassName?: string;
  title?: string;
  activeAriaLabel?: string;
  inactiveAriaLabel?: string;
};

/** Opens the browser `getDisplayMedia` picker (Chrome tab / window / screen). */
const DEFAULT_SHARE_SURFACE_MODE: CallScreenshareSurfaceMode = 'tab';

export function HumanChatPanelCallScreenshareMenu({
  isScreensharing,
  disabled = false,
  remoteScreenshareActive = false,
  onStartScreenshare,
  onStopScreenshare,
  triggerClassName,
  iconClassName,
  activeTriggerClassName,
  title,
  activeAriaLabel,
  inactiveAriaLabel,
}: HumanChatPanelCallScreenshareMenuProps) {
  const t = useTranslations('HumanChatPanel');

  const shareStartDisabled =
    disabled || (remoteScreenshareActive && !isScreensharing);

  if (isScreensharing) {
    return (
      <button
        type="button"
        onClick={onStopScreenshare}
        disabled={disabled}
        className={cn(triggerClassName, activeTriggerClassName)}
        title={title ?? t('callControlsScreenshare')}
        aria-label={activeAriaLabel ?? t('callControlsScreenshareActiveAria')}
      >
        <MonitorOff className={iconClassName} />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={shareStartDisabled}
      className={cn(
        triggerClassName,
        'inline-flex items-center justify-center',
        shareStartDisabled && 'cursor-not-allowed opacity-50',
      )}
      title={
        remoteScreenshareActive && !isScreensharing
          ? t('callScreenshareBlockedRemoteActive')
          : title ?? t('callControlsScreenshare')
      }
      aria-label={inactiveAriaLabel ?? t('callControlsScreenshareInactiveAria')}
      onClick={() => {
        if (shareStartDisabled) return;
        onStartScreenshare(DEFAULT_SHARE_SURFACE_MODE);
      }}
    >
      <Monitor className={iconClassName} />
    </button>
  );
}
