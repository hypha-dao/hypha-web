'use client';

import { FC } from 'react';

import { BankingAdvancedDialog } from './banking-advanced-dialog';
import type { BankCustomerPublicStatus } from '../hooks/types';

type BankingToolbarProps = {
  spaceSlug: string;
  status: BankCustomerPublicStatus | null | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  canManage: boolean;
  blockerMessage: string | null;
  gearOpen?: boolean;
  onGearOpenChange?: (open: boolean) => void;
  onRefreshStatus: () => Promise<BankCustomerPublicStatus | null | undefined>;
};

export const BankingToolbar: FC<BankingToolbarProps> = ({
  spaceSlug,
  status,
  isLoading,
  isRefreshing,
  canManage,
  blockerMessage,
  gearOpen,
  onGearOpenChange,
  onRefreshStatus,
}) => {
  return (
    <div className="flex min-h-9 w-full items-center justify-end gap-2 p-0">
      <BankingAdvancedDialog
        spaceSlug={spaceSlug}
        status={status}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        canManage={canManage}
        blockerMessage={blockerMessage}
        open={gearOpen}
        onOpenChange={onGearOpenChange}
        onRefreshStatus={onRefreshStatus}
      />
    </div>
  );
};
