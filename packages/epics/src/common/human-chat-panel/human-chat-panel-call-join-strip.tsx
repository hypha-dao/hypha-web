'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Phone, Video } from 'lucide-react';

type HumanChatPanelCallJoinStripProps = {
  /** Number of active devices in the room GroupCall (from Matrix member state). */
  deviceCount: number;
  disabled: boolean;
  busy: boolean;
  onJoinAudio: () => void;
  onJoinVideo: () => void;
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
}: HumanChatPanelCallJoinStripProps) {
  const t = useTranslations('HumanChatPanel');

  return (
    <div
      className="border-b border-border bg-accent-9/12 dark:bg-accent-9/15"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-[48px] flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
        <p className="min-w-0 text-xs leading-snug text-foreground sm:flex-1">
          <span className="font-medium">
            {t('callJoinStripTitle')}
            {` · `}
            {t('callJoinStripDevices', { count: deviceCount })}
          </span>
        </p>
        <div
          className="flex shrink-0 items-center justify-end gap-1.5"
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
  );
}
