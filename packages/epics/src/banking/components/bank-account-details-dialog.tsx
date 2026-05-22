'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type { BankVirtualAccountPublic } from '../hooks/types';
import { CurrencyFlagBadge } from './currency-flag-badge';
import { DepositInstructionsPanel } from './deposit-instructions-fields';

type BankAccountDetailsDialogProps = {
  account: BankVirtualAccountPublic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function accountToCurrency(
  account: BankVirtualAccountPublic,
): BankCurrencyCode {
  const c = account.currency.toLowerCase();
  if (
    c === 'eur' ||
    c === 'usd' ||
    c === 'gbp' ||
    c === 'mxn' ||
    c === 'brl' ||
    c === 'cop'
  ) {
    return c;
  }
  return 'usd';
}

export const BankAccountDetailsDialog: FC<BankAccountDetailsDialogProps> = ({
  account,
  open,
  onOpenChange,
}) => {
  const tCurrencies = useTranslations('BankingTab.currencies');

  if (!account) {
    return null;
  }

  const currency = accountToCurrency(account);
  const meta = getBankCurrencyMeta(currency);
  const title = meta
    ? `${tCurrencies(`${meta.nameKey}.code`)} — ${tCurrencies(
        `${meta.nameKey}.name`,
      )}`
    : account.currency.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-3">
            <CurrencyFlagBadge currency={currency} />
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
        </DialogHeader>
        <DepositInstructionsPanel account={account} />
      </DialogContent>
    </Dialog>
  );
};
