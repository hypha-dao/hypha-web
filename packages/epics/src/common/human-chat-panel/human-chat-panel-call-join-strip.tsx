'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type { SpaceGroupCallCaptureConsent } from '@hypha-platform/core/client';
import { Phone, Video, X } from 'lucide-react';
import { HumanChatPanelCaptureConsentBanner } from './human-chat-panel-capture-consent-banner';

type HumanChatPanelCallJoinStripProps = {
  deviceCount: number;
  disabled: boolean;
  busy: boolean;
  onJoinAudio?: () => void;
  onJoinVideo: () => void;
  captureConsent?: SpaceGroupCallCaptureConsent | null;
  roomId?: string | null;
  /**
   * When set, replaces the “call in progress” line (e.g. “You left the call”).
   */
  durableMessage?: string | null;
  onDismissDurable?: () => void;
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
  captureConsent = null,
  roomId = null,
  durableMessage,
  onDismissDurable,
}: HumanChatPanelCallJoinStripProps) {
  const t = useTranslations('HumanChatPanel');
  const statusLine = t('callJoinStripLine', { count: deviceCount });
  const hasDurable = Boolean(durableMessage);
  const audioLabel =
    deviceCount > 0
      ? t('callJoinWithAudioShort')
      : t('callStartWithAudioShort');
  const videoLabel =
    deviceCount > 0
      ? t('callJoinWithVideoShort')
      : t('callStartWithVideoShort');
  const audioTitle =
    deviceCount > 0 ? t('callJoinWithAudio') : t('callStartWithAudio');
  const videoTitle =
    deviceCount > 0 ? t('callJoinWithVideo') : t('callStartWithVideo');
  const showAudioButton = deviceCount > 0 || Boolean(onJoinAudio);

  return (
    <div className="border-b border-border bg-muted/30">
      {captureConsent ? (
        <HumanChatPanelCaptureConsentBanner
          consent={captureConsent}
          roomId={roomId}
          variant="join"
          className="border-border/60"
        />
      ) : null}
      <div role="status" aria-live="polite">
        <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-1.5 sm:gap-3 sm:px-4">
          <p
            className={cn(
              'min-w-0 flex-1 basis-full text-xs font-medium leading-tight text-foreground sm:basis-auto',
              hasDurable &&
                'shrink-0 whitespace-nowrap sm:max-w-[min(100%,32rem)]',
            )}
            title={hasDurable ? durableMessage ?? undefined : statusLine}
          >
            {hasDurable && durableMessage ? (
              <span className="text-foreground">{durableMessage}</span>
            ) : (
              statusLine
            )}
          </p>

          <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            {hasDurable && onDismissDurable && (
              <button
                type="button"
                onClick={onDismissDurable}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                title={t('callLeftBannerDismiss')}
                aria-label={t('callLeftBannerDismiss')}
              >
                <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </button>
            )}

            {showAudioButton ? (
              <button
                type="button"
                onClick={onJoinAudio}
                disabled={disabled || busy || !onJoinAudio}
                className={cn(
                  'inline-flex h-8 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 text-xs font-medium text-foreground transition-colors',
                  (disabled || busy || !onJoinAudio) &&
                    'cursor-not-allowed opacity-50',
                  !disabled &&
                    !busy &&
                    Boolean(onJoinAudio) &&
                    'hover:bg-muted',
                )}
                title={audioTitle}
                aria-label={audioTitle}
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {audioLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onJoinVideo}
              disabled={disabled || busy}
              className={cn(
                'inline-flex h-8 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 text-xs font-medium text-foreground transition-colors',
                (disabled || busy) && 'cursor-not-allowed opacity-50',
                !disabled && !busy && 'hover:bg-muted',
              )}
              title={videoTitle}
              aria-label={videoTitle}
            >
              <Video className="h-3.5 w-3.5 shrink-0" />
              {videoLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
