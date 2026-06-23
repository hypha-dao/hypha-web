'use client';

import { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Empty } from '../../common';

import {
  BANKING_LOADING_STATE_CLASS,
  TREASURY_CARD_GRID_CLASS,
} from '../banking-ui';
import type { BankPayoutAccountPublic } from '../hooks/types';
import { PayoutAccountCard } from './payout-account-card';

type ApprovedBankingPayoutsProps = {
  payoutAccounts: BankPayoutAccountPublic[];
  payoutAccountsLoading: boolean;
  hideLoadingState?: boolean;
  onCardClick?: (account: BankPayoutAccountPublic) => void;
};

export const ApprovedBankingPayouts: FC<ApprovedBankingPayoutsProps> = ({
  payoutAccounts,
  payoutAccountsLoading,
  hideLoadingState = false,
  onCardClick,
}) => {
  const t = useTranslations('BankingTab.payouts');

  if (payoutAccountsLoading && !hideLoadingState) {
    return (
      <div className={BANKING_LOADING_STATE_CLASS}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-2 text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  if (payoutAccounts.length === 0) {
    return (
      <Empty className="w-full">
        <p>{t('emptyTitle')}</p>
      </Empty>
    );
  }

  return (
    <div className="w-full">
      <div className={TREASURY_CARD_GRID_CLASS}>
        {payoutAccounts.map((account) => (
          <PayoutAccountCard
            key={account.id}
            account={account}
            onClick={onCardClick ? () => onCardClick(account) : undefined}
          />
        ))}
      </div>
    </div>
  );
};
