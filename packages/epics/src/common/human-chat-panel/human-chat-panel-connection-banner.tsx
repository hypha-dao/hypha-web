'use client';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

import type { MatrixConnectionStatus } from '@hypha-platform/core/client';

type HumanChatPanelConnectionBannerProps = {
  connectionStatus: MatrixConnectionStatus;
  /** Set after an explicit Retry click fails. */
  connectionRetryFailed?: boolean;
  onRetry: () => void;
};

const accentBorder =
  'border-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_30%,transparent)]';
const accentSurface =
  'bg-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_12%,var(--background))]';
const bannerButtonClassName =
  'h-7 min-h-7 shrink-0 gap-1.5 self-center border-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_45%,var(--border))] bg-background/90 px-2.5 py-0 text-xs font-semibold leading-none whitespace-nowrap text-foreground hover:bg-accent-3 disabled:opacity-50';

/**
 * "Matrix `/sync` connection lost, click to retry" — per-tab, independent of any other tab
 * (#2456 removed the single-tab leader lock; every tab syncs on its own).
 */
export function HumanChatPanelConnectionBanner({
  connectionStatus,
  connectionRetryFailed = false,
  onRetry,
}: HumanChatPanelConnectionBannerProps) {
  const t = useTranslations('HumanChatPanel');

  if (connectionStatus === 'connected') {
    return null;
  }

  const isReconnecting = connectionStatus === 'reconnecting';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'mt-0 w-full border-y px-3 py-2 text-sm',
        accentBorder,
        accentSurface,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">
            {t('connectionLostTitle')}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {isReconnecting
              ? t('connectionReconnectingDescription')
              : connectionRetryFailed
              ? t('connectionRetryFailedDescription')
              : t('connectionLostDescription')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          colorVariant="neutral"
          className={bannerButtonClassName}
          disabled={isReconnecting}
          aria-busy={isReconnecting}
          onClick={onRetry}
        >
          <ReloadIcon
            className={cn('h-3.5 w-3.5', isReconnecting && 'animate-spin')}
          />
          {isReconnecting
            ? t('connectionRetryingLabel')
            : t('connectionLostRetry')}
        </Button>
      </div>
    </div>
  );
}
