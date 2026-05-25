'use client';

import { FC } from 'react';

import { BankingAdvancedDialog } from './banking-advanced-dialog';
import type { BankCustomerPublicStatus } from '../hooks/types';

type BankingToolbarProps = {
  spaceSlug: string;
  status: BankCustomerPublicStatus | null | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isSyncingBanking?: boolean;
  canManage: boolean;
  blockerMessage: string | null;
  gearOpen?: boolean;
  onGearOpenChange?: (open: boolean) => void;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
  onSyncBanking?: () => void;
};

export const BankingToolbar: FC<BankingToolbarProps> = ({
  spaceSlug,
  status,
  isLoading,
  isRefreshing,
  isSyncingBanking = false,
  canManage,
  blockerMessage,
  gearOpen,
  onGearOpenChange,
  onRefreshStatus,
  onSyncBanking,
}) => {
  return (
    <div className="flex w-full items-center justify-end gap-2">
      <BankingAdvancedDialog
        spaceSlug={spaceSlug}
        status={status}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        isSyncingBanking={isSyncingBanking}
        canManage={canManage}
        blockerMessage={blockerMessage}
        open={gearOpen}
        onOpenChange={onGearOpenChange}
        onRefreshStatus={onRefreshStatus}
        onSyncBanking={onSyncBanking}
      />
    </div>
  );
};
