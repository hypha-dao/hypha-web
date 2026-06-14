'use client';

import { FC } from 'react';
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@hypha-platform/ui';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type { BankPayoutAccountPublic } from '../hooks/types';
import { CurrencyFlagBadge } from './currency-flag-badge';
import { InlineCopyRow } from './inline-copy-row';

type PayoutAccountCardProps = {
  account: BankPayoutAccountPublic;
};

const RAIL_HUMAN_LABELS: Record<string, string> = {
  ach: 'ACH',
  sepa: 'SEPA',
  wire: 'Wire',
  faster_payments: 'Faster Payments',
  swift: 'SWIFT',
};

function humanRailLabel(paymentRail: string): string {
  return RAIL_HUMAN_LABELS[paymentRail.toLowerCase()] ?? paymentRail.toUpperCase();
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

function PayoutCurrencyIcon({ destinationCurrency }: { destinationCurrency: string }) {
  const currency = destinationCurrency.toLowerCase() as BankCurrencyCode;
  const meta = getBankCurrencyMeta(currency);

  if (!meta) {
    return (
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background-2 text-muted-foreground">
        <Globe className="h-5 w-5" strokeWidth={1.75} />
      </span>
    );
  }

  return <CurrencyFlagBadge currency={currency} />;
}

export const PayoutAccountCard: FC<PayoutAccountCardProps> = ({ account }) => {
  const t = useTranslations('BankingTab.payouts');

  const primaryLabel = account.bankName ?? t('cardBankFallback');
  const destination = account.destinationCurrency.toUpperCase();
  const source = account.sourceCurrency.toUpperCase();
  const rail = humanRailLabel(account.paymentRail);
  const maskedAccount = account.accountLast4 ? `••••${account.accountLast4}` : null;

  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <PayoutCurrencyIcon destinationCurrency={account.destinationCurrency} />
        <div className="min-w-0 flex-1">
          <p className="text-3 font-semibold text-foreground">{primaryLabel}</p>
          <p className="mt-0.5 text-2 text-muted-foreground">
            {maskedAccount
              ? `${destination} ${maskedAccount} · ${source} → ${rail}`
              : `${destination} · ${source} → ${rail}`}
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
