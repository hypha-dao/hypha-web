'use client';

import { FC, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Empty } from '../../common';
import {
  BANKING_LOADING_STATE_CLASS,
  TREASURY_CARD_GRID_CLASS,
} from '../banking-ui';
import type { BankVirtualAccountPublic } from '../hooks/types';
import { BankAccountCard } from './bank-account-card';
import { BankAccountDetailsDialog } from './bank-account-details-dialog';

export type ApprovedBankingDepositsProps = {
  virtualAccounts: BankVirtualAccountPublic[];
  virtualAccountsLoading: boolean;
  canManage: boolean;
  hideLoadingState?: boolean;
};

export const ApprovedBankingDeposits: FC<ApprovedBankingDepositsProps> = ({
  virtualAccounts,
  virtualAccountsLoading,
  canManage,
  hideLoadingState = false,
}) => {
  const tAccounts = useTranslations('BankingTab.sections.accounts');

  const [detailsAccount, setDetailsAccount] =
    useState<BankVirtualAccountPublic | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openDetails = (account: BankVirtualAccountPublic) => {
    setDetailsAccount(account);
    setDetailsOpen(true);
  };

  if (virtualAccountsLoading && !hideLoadingState) {
    return (
      <div className={BANKING_LOADING_STATE_CLASS}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-2 text-muted-foreground">
          {tAccounts('loadingAccounts')}
        </p>
      </div>
    );
  }

  if (virtualAccounts.length === 0) {
    return (
      <Empty className="w-full">
        <p>{tAccounts('emptyTitle')}</p>
        <p className="text-muted-foreground">{tAccounts('emptyDescription')}</p>
      </Empty>
    );
  }

  return (
    <div className="w-full">
      <div className={TREASURY_CARD_GRID_CLASS}>
        {virtualAccounts.map((account) => (
          <BankAccountCard
            key={account.id}
            account={account}
            onViewDetails={() => openDetails(account)}
          />
        ))}
      </div>

      <BankAccountDetailsDialog
        account={detailsAccount}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
};
