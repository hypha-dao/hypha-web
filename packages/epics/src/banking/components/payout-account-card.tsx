'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@hypha-platform/ui';

import type { BankPayoutAccountPublic } from '../hooks/types';
import { InlineCopyRow } from './inline-copy-row';

type PayoutAccountCardProps = {
  account: BankPayoutAccountPublic;
};

function formatAccountIdentifier(account: BankPayoutAccountPublic): string {
  if (account.accountLast4) {
    return `****${account.accountLast4}`;
  }
  return account.bankName ?? account.paymentRail.toUpperCase();
}

function statusBadgeClass(status: string): string {
  if (status === 'active') {
    return 'bg-success-9 text-white';
  }
  if (status === 'inactive' || status === 'deactivated') {
    return 'bg-neutral-9 text-white';
  }
  return 'bg-warning-9 text-neutral-12';
}

export const PayoutAccountCard: FC<PayoutAccountCardProps> = ({ account }) => {
  const t = useTranslations('BankingTab.payouts');
  const destination = account.destinationCurrency.toUpperCase();

  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-3 font-semibold text-foreground">
            {t('cardTitle', {
              destination,
              identifier: formatAccountIdentifier(account),
            })}
          </p>
          <p className="mt-0.5 text-2 text-muted-foreground">
            {t('cardSubtitle', {
              source: account.sourceCurrency.toUpperCase(),
              rail: account.paymentRail,
            })}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-1 font-medium ${statusBadgeClass(
            account.status,
          )}`}
        >
          {t(`status.${account.status}`, {
            defaultValue: account.status,
          })}
        </span>
      </div>

      <InlineCopyRow
        className="flex-1"
        label={t('liquidationAddressLabel')}
        value={account.evmAddress}
      />
    </Card>
  );
};
