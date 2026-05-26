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

const bannerButtonClassName =
  'h-7 min-h-7 shrink-0 gap-1.5 self-center border-border bg-background/90 px-2.5 py-0 text-xs font-semibold leading-none whitespace-nowrap text-foreground hover:bg-muted disabled:opacity-50';

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
        'mt-0 w-full border-y border-border/70 bg-muted/40 px-3 py-2 text-sm',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">
            {isFollower
              ? t('connectionFollowerTitle')
              : t('connectionLostTitle')}
          </p>
          <p className="mt-0.5 text-muted-foreground">
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
            colorVariant="neutral"
            className={bannerButtonClassName}
            onClick={onUseThisTab}
          >
            {t('connectionFollowerUseTab')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            className={bannerButtonClassName}
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
