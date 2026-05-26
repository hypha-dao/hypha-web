'use client';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

import type { MatrixConnectionStatus } from '@hypha-platform/core/client';

type HumanChatPanelConnectionBannerProps = {
  connectionStatus: MatrixConnectionStatus;
  isMatrixSyncLeader: boolean;
  onRetry: () => void;
  onUseThisTab: () => void;
};

const accentBorder =
  'border-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_30%,transparent)]';
const accentSurface =
  'bg-[color:color-mix(in_srgb,var(--color-accent-9,var(--space-accent,#4a65d8))_12%,var(--background))]';
const accentTitle = 'text-[color:var(--color-accent-12,var(--foreground))]';
const accentBody =
  'text-[color:color-mix(in_srgb,var(--color-accent-11,var(--foreground))_85%,transparent)]';
const accentButton =
  'h-7 min-h-7 shrink-0 gap-1.5 self-center border-[color:var(--space-accent)] bg-background px-2.5 py-0 text-xs font-semibold leading-none whitespace-nowrap text-[color:var(--space-accent)] hover:bg-accent-3 disabled:border-[color:var(--space-accent)]/45 disabled:text-[color:var(--space-accent)]/55 disabled:opacity-100';

export function HumanChatPanelConnectionBanner({
  connectionStatus,
  isMatrixSyncLeader,
  onRetry,
  onUseThisTab,
}: HumanChatPanelConnectionBannerProps) {
  const t = useTranslations('HumanChatPanel');

  if (connectionStatus === 'connected') {
    return null;
  }

  const isFollower = !isMatrixSyncLeader || connectionStatus === 'follower';
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
          <p className={cn('font-medium', accentTitle)}>
            {isFollower
              ? t('connectionFollowerTitle')
              : t('connectionLostTitle')}
          </p>
          <p className={cn('mt-0.5', accentBody)}>
            {isFollower
              ? t('connectionFollowerDescription')
              : isReconnecting
              ? t('connectionReconnectingDescription')
              : t('connectionLostDescription')}
          </p>
        </div>
        {isFollower ? (
          <Button
            type="button"
            variant="outline"
            colorVariant="accent"
            className={accentButton}
            onClick={onUseThisTab}
          >
            {t('connectionFollowerUseTab')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            colorVariant="accent"
            className={accentButton}
            disabled={isReconnecting}
            onClick={onRetry}
          >
            <ReloadIcon className="h-3.5 w-3.5" />
            {t('connectionLostRetry')}
          </Button>
        )}
      </div>
    </div>
  );
}
