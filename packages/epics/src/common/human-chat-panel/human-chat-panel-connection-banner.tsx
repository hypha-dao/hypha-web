'use client';

import { Button } from '@hypha-platform/ui';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';

import type { MatrixConnectionStatus } from '@hypha-platform/core/client';

type HumanChatPanelConnectionBannerProps = {
  connectionStatus: MatrixConnectionStatus;
  isMatrixSyncLeader: boolean;
  onRetry: () => void;
  onUseThisTab: () => void;
};

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
      className="mt-0 w-full border-y border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {isFollower
              ? t('connectionFollowerTitle')
              : t('connectionLostTitle')}
          </p>
          <p className="text-amber-700/90 dark:text-amber-100/90">
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
            size="sm"
            variant="outline"
            className="gap-2 shrink-0"
            onClick={onUseThisTab}
          >
            {t('connectionFollowerUseTab')}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 shrink-0"
            disabled={isReconnecting}
            onClick={onRetry}
          >
            <ReloadIcon />
            {t('connectionLostRetry')}
          </Button>
        )}
      </div>
    </div>
  );
}
