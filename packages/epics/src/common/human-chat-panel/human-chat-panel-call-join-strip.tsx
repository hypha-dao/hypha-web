'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';
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
  /** Space hero: accent strip above the banner image. */
  variant?: 'sidebar' | 'hero';
};

const joinBannerSurfaceClass =
  'rounded-[8px] border border-accent-6 bg-accent-surface-mix bg-center';

/**
 * Idle: others are in the room GroupCall — join CTA aligned with subscription/sales banners.
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
  variant = 'sidebar',
}: HumanChatPanelCallJoinStripProps) {
  const t = useTranslations('HumanChatPanel');
  const isHero = variant === 'hero';
  const isJoinOpportunity = deviceCount > 0;
  const hasDurable = Boolean(durableMessage);
  const statusLine = t('callJoinStripLine', { count: deviceCount });
  const title = hasDurable
    ? durableMessage ?? t('callJoinStripTitle')
    : isJoinOpportunity
    ? t('callJoinStripTitle')
    : statusLine;
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
  const useProminentJoinBanner = isJoinOpportunity && !hasDurable;

  const actionButtons = (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-2',
        isHero
          ? 'w-full justify-end lg:w-auto'
          : 'w-full min-w-0 sm:justify-end',
      )}
    >
      {hasDurable && onDismissDurable ? (
        <button
          type="button"
          onClick={onDismissDurable}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
          title={t('callLeftBannerDismiss')}
          aria-label={t('callLeftBannerDismiss')}
        >
          <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}

      {showAudioButton ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onJoinAudio}
          disabled={disabled || busy || !onJoinAudio}
          className={cn(
            'gap-1.5',
            isHero ? 'flex-1 lg:flex-none' : 'h-8 min-w-0 flex-1 px-2 text-xs',
          )}
          title={audioTitle}
          aria-label={audioTitle}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{audioLabel}</span>
        </Button>
      ) : null}
      <Button
        type="button"
        variant={useProminentJoinBanner ? 'default' : 'outline'}
        size="sm"
        onClick={onJoinVideo}
        disabled={disabled || busy}
        className={cn(
          'gap-1.5',
          isHero ? 'flex-1 lg:flex-none' : 'h-8 min-w-0 flex-1 px-2 text-xs',
        )}
        title={videoTitle}
        aria-label={videoTitle}
      >
        <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{videoLabel}</span>
      </Button>
    </div>
  );

  return (
    <div
      className={cn(
        isHero ? cn('mb-2', joinBannerSurfaceClass) : 'border-b border-border',
        useProminentJoinBanner && !isHero && joinBannerSurfaceClass,
        !useProminentJoinBanner && !isHero && 'bg-muted/30',
      )}
    >
      {captureConsent ? (
        <HumanChatPanelCaptureConsentBanner
          consent={captureConsent}
          roomId={roomId}
          variant="join"
          className={
            isHero || useProminentJoinBanner
              ? 'rounded-none border-x-0 border-t-0'
              : 'border-border/60'
          }
        />
      ) : null}
      <div role="status" aria-live="polite">
        {useProminentJoinBanner ? (
          <div
            className={cn(
              'flex flex-col gap-3',
              isHero
                ? 'gap-4 p-5 lg:flex-row lg:items-center lg:justify-between'
                : 'px-4 py-3',
            )}
          >
            <div
              className={cn(
                'flex min-w-0 items-start gap-3',
                isHero && 'lg:gap-5',
              )}
            >
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-9 text-accent-contrast shadow-sm ring-2 ring-accent-9/25"
                aria-hidden
              >
                <Phone className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    'font-bold leading-snug text-foreground',
                    isHero ? 'text-2' : 'text-sm',
                  )}
                >
                  {title}
                </span>
                <span
                  className={cn(
                    'leading-snug text-foreground/70',
                    isHero ? 'text-1' : 'text-xs',
                  )}
                >
                  {t('callJoinStripMemberCount', { count: deviceCount })}
                </span>
              </div>
            </div>
            {actionButtons}
          </div>
        ) : (
          <div
            className={cn(
              'flex min-w-0 flex-col gap-2',
              isHero
                ? 'min-h-10 px-3 py-1.5 sm:px-4'
                : 'min-h-11 px-3 py-1.5 sm:px-4',
            )}
          >
            <p
              className={cn(
                'min-w-0 text-xs font-medium leading-snug',
                isHero
                  ? 'text-[color:var(--color-accent-12,var(--foreground))]'
                  : 'text-foreground',
                hasDurable && 'text-foreground',
              )}
              title={hasDurable ? durableMessage ?? undefined : statusLine}
            >
              {hasDurable && durableMessage ? (
                <span className="text-foreground">{durableMessage}</span>
              ) : (
                statusLine
              )}
            </p>
            {actionButtons}
          </div>
        )}
      </div>
    </div>
  );
}
