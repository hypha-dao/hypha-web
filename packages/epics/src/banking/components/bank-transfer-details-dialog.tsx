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
  getTransferCorridorKeyFromStored,
  type BankCurrencyCode,
} from '../bank-currency-display';
import type { BankTransferPublic } from '../hooks/types';
import {
  BANKING_DIALOG_CONTENT_CLASS,
  BANKING_DIALOG_HEADER_CLASS,
  BankingDialogBody,
} from './banking-dialog-layout';
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
  const tCorridors = useTranslations('BankingTab.transferCorridors');

  if (!transfer) {
    return null;
  }

  const currency = transferToCurrency(transfer);
  const corridorKey = getTransferCorridorKeyFromStored(
    transfer.currency,
    transfer.paymentRail,
  );
  const title = corridorKey
    ? `${tCorridors(`${corridorKey}.label`)} — ${t('title')}`
    : t('title');

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
          <DepositInstructionsPanel transfer={transfer} />
        </BankingDialogBody>
      </DialogContent>
    </Dialog>
  );
};
