'use client';

import { Monitor, MonitorOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

type HumanChatPanelCallScreenshareMenuProps = {
  isScreensharing: boolean;
  disabled?: boolean;
  /** Another participant is presenting — only one share at a time. */
  remoteScreenshareActive?: boolean;
  /** Opens the browser display-media picker (tab / window / entire screen). */
  onStartScreenshare: () => void;
  onStopScreenshare: () => void;
  triggerClassName?: string;
  iconClassName?: string;
  iconStrokeWidth?: number;
  activeTriggerClassName?: string;
  title?: string;
  activeAriaLabel?: string;
  inactiveAriaLabel?: string;
};

/**
 * Single share control — no Hypha surface picker. Click opens the native
 * `getDisplayMedia` dialog; audio defaults are set in screenshare-capture.
 */
export function HumanChatPanelCallScreenshareMenu({
  isScreensharing,
  disabled = false,
  remoteScreenshareActive = false,
  onStartScreenshare,
  onStopScreenshare,
  triggerClassName,
  iconClassName,
  iconStrokeWidth,
  activeTriggerClassName,
  title,
  activeAriaLabel,
  inactiveAriaLabel,
}: HumanChatPanelCallScreenshareMenuProps) {
  const t = useTranslations('HumanChatPanel');

  const shareStartDisabled = disabled;

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
        <MonitorOff className={iconClassName} strokeWidth={iconStrokeWidth} />
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
          ? t('callScreenshareRequestTakeover')
          : title ?? t('callControlsScreenshare')
      }
      aria-label={inactiveAriaLabel ?? t('callControlsScreenshareInactiveAria')}
      onClick={() => {
        if (shareStartDisabled) return;
        onStartScreenshare();
      }}
    >
      <Monitor className={iconClassName} strokeWidth={iconStrokeWidth} />
    </button>
  );
}
