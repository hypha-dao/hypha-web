'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';
import type { SpaceGroupCallCaptureConsent } from '@hypha-platform/core/client';
import { Phone, RefreshCw, Video, X } from 'lucide-react';
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
  /** #2456 D2c/D2e: this user already has a stale presence in this room's call — show
   * "Refresh call" instead of "Join call" (pulsing badge + different labels/tooltip). */
  isRefresh?: boolean;
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
  isRefresh = false,
}: HumanChatPanelCallJoinStripProps) {
  const t = useTranslations('HumanChatPanel');
  const isHero = variant === 'hero';
  const isJoinOpportunity = deviceCount > 0 || isRefresh;
  const hasDurable = Boolean(durableMessage);
  const statusLine = isRefresh
    ? t('callRefreshStripLine')
    : t('callJoinStripLine', { count: deviceCount });
  const audioLabel = isRefresh
    ? t('callRefreshWithAudioShort')
    : deviceCount > 0
    ? t('callJoinWithAudioShort')
    : t('callStartWithAudioShort');
  const videoLabel = isRefresh
    ? t('callRefreshWithVideoShort')
    : deviceCount > 0
    ? t('callJoinWithVideoShort')
    : t('callStartWithVideoShort');
  const audioTitle = isRefresh
    ? t('callRefreshWithAudio')
    : deviceCount > 0
    ? t('callJoinWithAudio')
    : t('callStartWithAudio');
  const videoTitle = isRefresh
    ? t('callRefreshWithVideo')
    : deviceCount > 0
    ? t('callJoinWithVideo')
    : t('callStartWithVideo');
  const showAudioButton = deviceCount > 0 || Boolean(onJoinAudio);
  const useProminentJoinBanner = isJoinOpportunity && !hasDurable;

  /** No active room call to join — avoid empty "Call in progress — 0 members" chrome. Refresh
   * opportunities are exempt: a lone stale self-presence has deviceCount 0 (excludes self) but
   * still needs to render the "Refresh call" affordance. */
  if (!hasDurable && !isRefresh && deviceCount <= 0) {
    return null;
  }

  const actionButtons = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {hasDurable && onDismissDurable ? (
        <button
          type="button"
          onClick={onDismissDurable}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
          title={t('callLeftBannerDismiss')}
          aria-label={t('callLeftBannerDismiss')}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}

      {showAudioButton ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onJoinAudio}
          disabled={disabled || busy || !onJoinAudio}
          className="shrink-0 gap-1"
          title={audioTitle}
          aria-label={audioTitle}
        >
          {isRefresh ? (
            <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate">{audioLabel}</span>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        colorVariant="accent"
        size="sm"
        onClick={onJoinVideo}
        disabled={disabled || busy}
        className="shrink-0 gap-1"
        title={videoTitle}
        aria-label={videoTitle}
      >
        {isRefresh ? (
          <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
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
        <div
          className={cn(
            'flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1.5',
            isHero ? 'p-3 lg:gap-3 lg:p-4' : 'px-3 py-1.5',
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {useProminentJoinBanner ? (
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-9 text-accent-contrast shadow-sm ring-1 ring-accent-9/25',
                  isRefresh && 'animate-pulse',
                )}
                aria-hidden
              >
                {isRefresh ? (
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
                ) : (
                  <Phone className="h-3.5 w-3.5" strokeWidth={2.25} />
                )}
              </div>
            ) : null}
            <p
              className={cn(
                'min-w-0 truncate font-semibold leading-tight text-foreground',
                isHero ? 'text-sm' : 'text-xs',
              )}
              title={
                useProminentJoinBanner
                  ? statusLine
                  : hasDurable
                  ? durableMessage ?? undefined
                  : statusLine
              }
            >
              {useProminentJoinBanner
                ? statusLine
                : hasDurable && durableMessage
                ? durableMessage
                : statusLine}
            </p>
          </div>
          {actionButtons}
        </div>
      </div>
    </div>
  );
}
