'use client';

import { FC, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { BankVirtualAccountPublic } from '../hooks/types';
import { BankAccountCard } from './bank-account-card';
import { BankAccountDetailsDialog } from './bank-account-details-dialog';

export type ApprovedBankingDepositsProps = {
  virtualAccounts: BankVirtualAccountPublic[];
  virtualAccountsLoading: boolean;
  canManage: boolean;
  isActivating: boolean;
  provisionError: string | null;
  onOpenVerificationDetails: () => void;
  onActivateAccount: (accountId: number) => void;
};

export const ApprovedBankingDeposits: FC<ApprovedBankingDepositsProps> = ({
  virtualAccounts,
  virtualAccountsLoading,
  canManage,
  isActivating,
  provisionError,
  onOpenVerificationDetails,
  onActivateAccount,
}) => {
  const tAccounts = useTranslations('BankingTab.sections.accounts');

  const [detailsAccount, setDetailsAccount] =
    useState<BankVirtualAccountPublic | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const openDetails = (account: BankVirtualAccountPublic) => {
    setDetailsAccount(account);
    setDetailsOpen(true);
  };

  if (virtualAccountsLoading) {
    return (
      <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background-2/50 py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-2 text-muted-foreground">
          {tAccounts('loadingAccounts')}
        </p>
      </div>
    );
  }

  if (virtualAccounts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background-2/50 px-4 py-10 text-center">
        <p className="text-3 font-medium text-foreground">
          {tAccounts('emptyTitle')}
        </p>
        <p className="mx-auto mt-2 max-w-md text-2 text-muted-foreground">
          {tAccounts('emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {virtualAccounts.map((account) => (
          <BankAccountCard
            key={account.id}
            account={account}
            onViewDetails={() => openDetails(account)}
            onOpenVerificationDetails={
              canManage && account.lifecycle === 'pending_kyb'
                ? onOpenVerificationDetails
                : undefined
            }
            onActivate={
              canManage && account.canActivate
                ? () => onActivateAccount(account.id)
                : undefined
            }
            isActivating={isActivating}
          />
        ))}
      </div>

      {provisionError ? (
        <p className="rounded-md border border-error-6 bg-error-2 px-3 py-2 text-2 text-error-11">
          {provisionError}
        </p>
      ) : null}

      <BankAccountDetailsDialog
        account={detailsAccount}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
};
