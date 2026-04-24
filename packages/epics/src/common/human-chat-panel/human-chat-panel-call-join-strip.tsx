'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Phone, Video, Volume2, VolumeX } from 'lucide-react';

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
  const statusLine = t('callJoinStripLine', { count: deviceCount });
  const alertsMuted = !callAlertsUnmuted;

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
          <button
            type="button"
            disabled={disabled}
            onClick={() => onCallAlertsUnmutedChange(!callAlertsUnmuted)}
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring',
              'text-white',
              alertsMuted
                ? 'border-destructive/50 bg-destructive/25 hover:bg-destructive/35'
                : 'border-border/60 bg-zinc-900/85 hover:bg-zinc-800/90 dark:border-border/50 dark:bg-zinc-950/90 dark:hover:bg-zinc-900/95',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            title={
              callAlertsUnmuted
                ? t('callJoinCallAlertsUnmuted')
                : t('callJoinCallAlertsMuted')
            }
            aria-label={
              callAlertsUnmuted
                ? t('callJoinCallAlertsMuteAction')
                : t('callJoinCallAlertsUnmuteAction')
            }
            aria-pressed={alertsMuted}
          >
            {alertsMuted ? (
              <VolumeX
                className="h-4 w-4 shrink-0"
                strokeWidth={2.25}
                aria-hidden
              />
            ) : (
              <Volume2
                className="h-4 w-4 shrink-0"
                strokeWidth={2.25}
                aria-hidden
              />
            )}
          </button>

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
