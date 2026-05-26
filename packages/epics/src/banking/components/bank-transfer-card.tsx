'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  getBankCurrencyMeta,
  getTransferCorridorKeyFromStored,
  type BankCurrencyCode,
} from '../bank-currency-display';
import {
  formatCompletedTransferReferenceText,
  getCompletedTransferReferenceRows,
  getDepositMessage,
  getTransferCardDepositCopyBlock,
} from '../deposit-instruction-display';
import type { BankTransferPublic } from '../hooks/types';
import { isTransferDepositInstructionsReadOnly } from '../banking-ui';
import { InlineCopyRow } from './inline-copy-row';
import { CurrencyFlagBadge } from './currency-flag-badge';

type BankTransferCardProps = {
  transfer: BankTransferPublic;
  onViewDetails: () => void;
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

function getTransferStatusBadgeClass(status: string): string {
  switch (status) {
    case 'payment_processed':
      return 'bg-muted text-muted-foreground';
    case 'funds_received':
      return 'bg-accent-9 text-white';
    case 'in_review':
    case 'undeliverable':
    case 'returned':
      return 'bg-amber-9/90 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export const BankTransferCard: FC<BankTransferCardProps> = ({
  transfer,
  onViewDetails,
}) => {
  const t = useTranslations('BankingTab');
  const tFields = useTranslations('BankingTab.depositInstructions');
  const tDetails = useTranslations('BankingTab.transferDetails');
  const tCorridors = useTranslations('BankingTab.transferCorridors');
  const tStatus = useTranslations('BankingTab.transferStatus');
  const currency = transferToCurrency(transfer);
  const meta = getBankCurrencyMeta(currency);
  const corridorKey = getTransferCorridorKeyFromStored(
    transfer.currency,
    transfer.paymentRail,
  );

  const bridgeStatuses = [
    'awaiting_funds',
    'funds_received',
    'payment_processed',
    'canceled',
    'cancelled',
    'failed',
    'returned',
    'in_review',
    'undeliverable',
  ] as const;

  const statusLabel = bridgeStatuses.includes(
    transfer.status as (typeof bridgeStatuses)[number],
  )
    ? tStatus(transfer.status as (typeof bridgeStatuses)[number])
    : transfer.status;

  const corridorLabel = corridorKey
    ? tCorridors(`${corridorKey}.label`)
    : meta
    ? meta.currency.toUpperCase()
    : transfer.currency.toUpperCase();

  const amountLabel = transfer.amount
    ? `${transfer.amount} ${transfer.currency.toUpperCase()}`
    : t('transferCard.flexibleAmount');

  const instructionsReadOnly = isTransferDepositInstructionsReadOnly(transfer);
  const depositMessage = getDepositMessage(
    transfer.depositInstructions,
    transfer.depositMessage,
  );

  const cardCopyBlock = instructionsReadOnly
    ? (() => {
        const referenceText = formatCompletedTransferReferenceText(
          getCompletedTransferReferenceRows(transfer, (amount, cur) =>
            amount
              ? `${amount} ${cur.toUpperCase()}`
              : t('transferCard.flexibleAmount'),
          ),
          (key) =>
            key === 'amount' ? tDetails('amountLabel') : tFields(key),
        );
        return referenceText
          ? {
              label: null,
              copyText: referenceText,
              multiline: true,
            }
          : null;
      })()
    : getTransferCardDepositCopyBlock(
        transfer.paymentRail,
        transfer.depositInstructions,
        depositMessage,
        (key) => tFields(key),
        () => tFields('depositMessage'),
      );

  return (
    <Card
      className={cn(
        'flex h-full cursor-pointer flex-col gap-3 p-5 transition-colors hover:bg-background-2/50',
        instructionsReadOnly && 'opacity-70',
      )}
      role="button"
      tabIndex={0}
      onClick={onViewDetails}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewDetails();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <CurrencyFlagBadge currency={currency} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-3 font-semibold',
              instructionsReadOnly
                ? 'text-muted-foreground'
                : 'text-foreground',
            )}
          >
            {corridorLabel}
          </p>
          <p className="mt-0.5 text-2 text-muted-foreground">{amountLabel}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-1 font-medium ${getTransferStatusBadgeClass(
            transfer.status,
          )}`}
        >
          {statusLabel}
        </span>
      </div>

      {cardCopyBlock ? (
        <InlineCopyRow
          className="flex-1"
          label={cardCopyBlock.label}
          value={cardCopyBlock.copyText}
          multiline={cardCopyBlock.multiline}
          readOnly={instructionsReadOnly}
        />
      ) : (
        <div className="flex-1" />
      )}

      <button
        type="button"
        className="w-fit text-2 font-medium text-accent-11 hover:underline"
        onClick={(event) => {
          event.stopPropagation();
          onViewDetails();
        }}
      >
        {t('transferCard.viewDetails')}
      </button>
    </Card>
  );
};
