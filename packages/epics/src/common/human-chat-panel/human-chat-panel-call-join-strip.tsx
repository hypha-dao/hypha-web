'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Label, Switch } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Phone, Video } from 'lucide-react';

type HumanChatPanelCallJoinStripProps = {
  deviceCount: number;
  disabled: boolean;
  busy: boolean;
  onJoinAudio: () => void;
  onJoinVideo: () => void;
  /**
   * When `true`, play chime/notification for join opportunities (per-room dedupe in parent).
   * @see useCallJoinChime
   */
  callAlertsUnmuted: boolean;
  onCallAlertsUnmutedChange: (unmuted: boolean) => void;
};

/**
 * Idle: others are in the room GroupCall — one row, aligned with the in-call banner.
 */
export function HumanChatPanelCallJoinStrip({
  deviceCount,
  disabled,
  busy,
  onJoinAudio,
  onJoinVideo,
  callAlertsUnmuted,
  onCallAlertsUnmutedChange,
}: HumanChatPanelCallJoinStripProps) {
  const t = useTranslations('HumanChatPanel');
  const alertsId = useId();
  const statusLine = t('callJoinStripLine', { count: deviceCount });

  return (
    <div
      className="border-b border-border bg-muted/30"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-11 min-w-0 items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4">
        <p
          className="min-w-0 flex-1 text-xs font-medium leading-tight text-foreground"
          title={statusLine}
        >
          {statusLine}
        </p>

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
          <div className="flex min-w-0 max-w-[min(100%,9rem)] items-center gap-1.5 sm:max-w-[12.5rem] sm:gap-2">
            <Label
              htmlFor={alertsId}
              className="line-clamp-2 max-w-[7rem] cursor-pointer text-[10px] font-medium leading-tight text-muted-foreground sm:line-clamp-1 sm:max-w-none sm:shrink-0 sm:whitespace-nowrap sm:uppercase sm:tracking-wide"
            >
              {t('callJoinCallAlerts')}
            </Label>
            <Switch
              id={alertsId}
              className="shrink-0"
              checked={callAlertsUnmuted}
              onCheckedChange={onCallAlertsUnmutedChange}
              disabled={disabled}
              title={
                callAlertsUnmuted
                  ? t('callJoinCallAlertsUnmuted')
                  : t('callJoinCallAlertsMuted')
              }
              aria-label={t('callJoinCallAlertsAria')}
            />
          </div>

          <div
            className="flex shrink-0 items-center justify-end gap-1.5"
            role="group"
            aria-label={t('callJoinControlsGroup')}
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
