'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Label, Switch } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Phone, Video } from 'lucide-react';

type HumanChatPanelCallJoinStripProps = {
  /** Number of active devices in the room GroupCall (from Matrix member state). */
  deviceCount: number;
  disabled: boolean;
  busy: boolean;
  onJoinAudio: () => void;
  onJoinVideo: () => void;
  /** When set, shows a “join alert sound” switch (localStorage-persisted in parent). */
  joinAlertSoundEnabled?: boolean;
  onJoinAlertSoundChange?: (enabled: boolean) => void;
};

/**
 * Shown when another member has an active group call in the room and the local
 * user has not entered yet. Same as tapping phone/video (join existing GroupCall).
 */
export function HumanChatPanelCallJoinStrip({
  deviceCount,
  disabled,
  busy,
  onJoinAudio,
  onJoinVideo,
  joinAlertSoundEnabled,
  onJoinAlertSoundChange,
}: HumanChatPanelCallJoinStripProps) {
  const t = useTranslations('HumanChatPanel');
  const showSoundToggle =
    joinAlertSoundEnabled !== undefined && onJoinAlertSoundChange;
  const joinAlertSoundId = useId();

  return (
    <div
      className="border-b border-border bg-accent-9/12 dark:bg-accent-9/15"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:px-4">
        <p className="min-w-0 text-xs leading-snug text-foreground">
          <span className="font-medium">
            {t('callJoinStripTitle')}
            {` · `}
            {t('callJoinStripDevices', { count: deviceCount })}
          </span>
        </p>

        <div
          className={cn(
            'flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3',
            showSoundToggle && 'sm:justify-between',
            !showSoundToggle && 'sm:justify-end',
          )}
        >
          {showSoundToggle && (
            <div
              className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-border/50 bg-background/55 px-2.5 py-1.5 shadow-sm sm:w-auto sm:min-w-0 sm:max-w-[min(100%,22rem)] sm:justify-start sm:gap-2.5"
              role="group"
              aria-label={t('callJoinAlertSound')}
            >
              <Label
                htmlFor={joinAlertSoundId}
                className="min-w-0 flex-1 cursor-pointer text-left text-xs leading-snug text-foreground/95"
              >
                {t('callJoinAlertSound')}
              </Label>
              <Switch
                id={joinAlertSoundId}
                className="shrink-0"
                checked={joinAlertSoundEnabled}
                onCheckedChange={onJoinAlertSoundChange}
                disabled={disabled}
                title={
                  joinAlertSoundEnabled
                    ? t('callJoinAlertSoundOn')
                    : t('callJoinAlertSoundOff')
                }
              />
            </div>
          )}

          <div
            className="flex shrink-0 items-center justify-end gap-1.5 sm:ml-auto sm:justify-end"
            role="group"
            aria-label={t('callJoinWithAudio')}
          >
            <button
              type="button"
              onClick={onJoinAudio}
              disabled={disabled || busy}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 text-xs font-medium text-foreground transition-colors',
                (disabled || busy) && 'cursor-not-allowed opacity-50',
                !disabled && !busy && 'hover:bg-muted',
              )}
              aria-label={t('callJoinWithAudio')}
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {t('callJoinWithAudioShort')}
            </button>
            <button
              type="button"
              onClick={onJoinVideo}
              disabled={disabled || busy}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 text-xs font-medium text-foreground transition-colors',
                (disabled || busy) && 'cursor-not-allowed opacity-50',
                !disabled && !busy && 'hover:bg-muted',
              )}
              aria-label={t('callJoinWithVideo')}
            >
              <Video className="h-3.5 w-3.5 shrink-0" />
              {t('callJoinWithVideoShort')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
