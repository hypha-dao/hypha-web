'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card } from '@hypha-platform/ui';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { getPrimaryDepositIdentifier } from '../deposit-instruction-display';
import type { BankTransferPublic } from '../hooks/types';
import { InlineCopyRow } from './inline-copy-row';
import { CurrencyFlagBadge } from './currency-flag-badge';

type BankTransferCardProps = {
  transfer: BankTransferPublic;
  onViewDetails: () => void;
  onOpenVerificationDetails?: () => void;
  onActivate?: () => void;
  isActivating?: boolean;
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

function getTransferStatusBadgeClass(
  lifecycle: BankTransferPublic['lifecycle'],
  status: string,
): string {
  if (lifecycle === 'pending_kyb' || lifecycle === 'pending_activation') {
    return 'bg-amber-9/90 text-white';
  }
  switch (status) {
    case 'payment_processed':
      return 'bg-success-9 text-white';
    case 'funds_received':
      return 'bg-accent-9 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export const BankTransferCard: FC<BankTransferCardProps> = ({
  transfer,
  onViewDetails,
  onOpenVerificationDetails,
  onActivate,
  isActivating = false,
}) => {
  const t = useTranslations('BankingTab');
  const tFields = useTranslations('BankingTab.depositInstructions');
  const tCurrencies = useTranslations('BankingTab.currencies');
  const tStatus = useTranslations('BankingTab.transferStatus');
  const tOp = useTranslations('BankingTab.operationStatus');
  const currency = transferToCurrency(transfer);
  const meta = getBankCurrencyMeta(currency);

  const bridgeStatuses = [
    'awaiting_funds',
    'funds_received',
    'payment_processed',
  ] as const;
  const statusLabel =
    transfer.lifecycle === 'pending_kyb'
      ? tOp('pendingKyb')
      : transfer.lifecycle === 'pending_activation'
      ? tOp('pendingActivation')
      : bridgeStatuses.includes(
          transfer.status as (typeof bridgeStatuses)[number],
        )
      ? tStatus(transfer.status as (typeof bridgeStatuses)[number])
      : transfer.status;

  const amountLabel = transfer.amount
    ? `${transfer.amount} ${transfer.currency.toUpperCase()}`
    : t('transferCard.flexibleAmount');

  const isPendingKyb = transfer.lifecycle === 'pending_kyb';
  const handleCardClick =
    isPendingKyb && onOpenVerificationDetails
      ? onOpenVerificationDetails
      : !isPendingKyb
      ? onViewDetails
      : undefined;

  const primaryIdentifier =
    transfer.lifecycle === 'active'
      ? getPrimaryDepositIdentifier(
          transfer.paymentRail,
          transfer.depositInstructions,
        )
      : null;

  return (
    <Card
      className={`flex h-full flex-col gap-3 p-5${
        handleCardClick
          ? ' cursor-pointer transition-colors hover:bg-background-2/50'
          : ''
      }`}
      role={handleCardClick ? 'button' : undefined}
      tabIndex={handleCardClick ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={
        handleCardClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleCardClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <CurrencyFlagBadge currency={currency} />
        <div className="min-w-0 flex-1">
          <p className="text-3 font-semibold text-foreground">
            {meta
              ? tCurrencies(`${meta.nameKey}.code`)
              : transfer.currency.toUpperCase()}
          </p>
          <p className="mt-0.5 text-2 text-muted-foreground">{amountLabel}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-1 font-medium ${getTransferStatusBadgeClass(
            transfer.lifecycle,
            transfer.status,
          )}`}
        >
          {statusLabel}
        </span>
      </div>

      {primaryIdentifier ? (
        <InlineCopyRow
          className="flex-1"
          label={tFields(primaryIdentifier.labelKey)}
          value={primaryIdentifier.value}
        />
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex flex-col gap-1.5">
        {isPendingKyb ? (
          <p className="text-1 text-muted-foreground">
            {tOp('openGearForVerification')}
          </p>
        ) : null}
        {transfer.canActivate && onActivate ? (
          <Button
            type="button"
            colorVariant="accent"
            size="sm"
            className="h-7 min-h-7 w-fit px-3 py-0 text-xs"
            disabled={isActivating}
            onClick={(event) => {
              event.stopPropagation();
              onActivate();
            }}
          >
            {isActivating ? tOp('activating') : tOp('completeSetup')}
          </Button>
        ) : null}
        {transfer.lifecycle === 'active' ? (
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
        ) : null}
      </div>
    </Card>
  );
};
