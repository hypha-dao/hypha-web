'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Phone, X } from 'lucide-react';

type HumanChatPanelCallJoinStripProps = {
  deviceCount: number;
  disabled: boolean;
  busy: boolean;
  /** Enters the space call (voice+mic); use for the single “Join” CTA. */
  onJoinCall: () => void;
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
  onJoinCall,
  durableMessage,
  onDismissDurable,
}: HumanChatPanelCallJoinStripProps) {
  const t = useTranslations('HumanChatPanel');
  const statusLine = t('callJoinStripLine', { count: deviceCount });
  const hasDurable = Boolean(durableMessage);

  return (
    <div
      className="border-b border-border bg-muted/30"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-11 min-w-0 flex-nowrap items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4">
        <p
          className={cn(
            'min-w-0 text-xs font-medium leading-tight text-foreground',
            hasDurable ? 'shrink-0 whitespace-nowrap' : 'min-w-0 flex-1 pr-1',
            hasDurable && 'max-w-[min(100%,32rem)]',
          )}
          title={hasDurable ? durableMessage ?? undefined : statusLine}
        >
          {hasDurable && durableMessage ? (
            <span className="text-foreground">{durableMessage}</span>
          ) : (
            statusLine
          )}
        </p>

        <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
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

          {!hasDurable && (
            <button
              type="button"
              onClick={onJoinCall}
              disabled={disabled || busy}
              className={cn(
                'inline-flex h-8 min-w-0 max-w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 text-xs font-medium text-foreground transition-colors',
                (disabled || busy) && 'cursor-not-allowed opacity-50',
                !disabled && !busy && 'hover:bg-muted',
              )}
              title={t('callJoinInProgressCtaTitle')}
              aria-label={t('callJoinInProgressCtaTitle')}
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {t('callJoinInProgressCta')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
