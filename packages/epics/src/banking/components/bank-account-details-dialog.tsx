'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type { BankVirtualAccountPublic } from '../hooks/types';
import {
  BANKING_DIALOG_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
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
      <DialogContent className={cn(BANKING_DIALOG_CONTENT_CLASS, 'max-w-xl')}>
        <DialogHeader className={BANKING_DIALOG_HEADER_CLASS}>
          <div className="flex min-w-0 items-center gap-3 pr-8">
            <CurrencyFlagBadge currency={currency} />
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
        </DialogHeader>
        <BankingDialogBody>
          <DepositInstructionsPanel account={account} />
        </BankingDialogBody>
      </DialogContent>
    </Dialog>
  );
};
