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
import type { BankTransferPublic } from '../hooks/types';
import { CurrencyFlagBadge } from './currency-flag-badge';
import { DepositInstructionsPanel } from './deposit-instructions-fields';

type BankTransferDetailsDialogProps = {
  transfer: BankTransferPublic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function transferToCurrency(transfer: BankTransferPublic): BankCurrencyCode {
  const c = transfer.currency.toLowerCase();
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

export const BankTransferDetailsDialog: FC<BankTransferDetailsDialogProps> = ({
  transfer,
  open,
  onOpenChange,
}) => {
  const t = useTranslations('BankingTab.transferDetails');
  const tCurrencies = useTranslations('BankingTab.currencies');

  if (!transfer) {
    return null;
  }

  const currency = transferToCurrency(transfer);
  const meta = getBankCurrencyMeta(currency);
  const title = meta
    ? `${tCurrencies(`${meta.nameKey}.code`)} — ${t('title')}`
    : t('title');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-3">
            <CurrencyFlagBadge currency={currency} />
            <DialogTitle className="text-left">{title}</DialogTitle>
          </div>
        </DialogHeader>
        <DepositInstructionsPanel transfer={transfer} />
      </DialogContent>
    </Dialog>
  );
};
