'use client';

import { FC } from 'react';

import { BankingAdvancedDialog } from './banking-advanced-dialog';
import type { BankCustomerPublicStatus } from '../hooks/types';

type BankingToolbarProps = {
  spaceSlug: string;
  providers: BankCustomerPublicStatus[];
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
  providers,
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
        providers={providers}
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
