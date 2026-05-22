'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card } from '@hypha-platform/ui';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { getPrimaryDepositIdentifier } from '../deposit-instruction-display';
import type { BankVirtualAccountPublic } from '../hooks/types';
import { InlineCopyRow } from './inline-copy-row';
import { CurrencyFlagBadge } from './currency-flag-badge';

type BankAccountCardProps = {
  account: BankVirtualAccountPublic;
  onViewDetails: () => void;
  onOpenVerificationDetails?: () => void;
  onActivate?: () => void;
  isActivating?: boolean;
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

export const BankAccountCard: FC<BankAccountCardProps> = ({
  account,
  onViewDetails,
  onOpenVerificationDetails,
  onActivate,
  isActivating = false,
}) => {
  const t = useTranslations('BankingTab');
  const tFields = useTranslations('BankingTab.depositInstructions');
  const tCurrencies = useTranslations('BankingTab.currencies');
  const tOp = useTranslations('BankingTab.operationStatus');
  const currency = accountToCurrency(account);
  const meta = getBankCurrencyMeta(currency);

  const statusLabel =
    account.lifecycle === 'pending_kyb'
      ? tOp('pendingKyb')
      : account.lifecycle === 'pending_activation'
      ? tOp('pendingActivation')
      : t('depositInstructions.activeBadge');

  const badgeClass =
    account.lifecycle === 'active'
      ? 'bg-success-9 text-white'
      : 'bg-amber-9/90 text-white';

  const isPendingKyb = account.lifecycle === 'pending_kyb';
  const handleCardClick =
    isPendingKyb && onOpenVerificationDetails
      ? onOpenVerificationDetails
      : !isPendingKyb
      ? onViewDetails
      : undefined;

  const primaryIdentifier =
    account.lifecycle === 'active'
      ? getPrimaryDepositIdentifier(
          account.paymentRail,
          account.depositInstructions,
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
              : account.currency.toUpperCase()}
          </p>
          <p className="mt-0.5 text-2 text-muted-foreground">
            {meta
              ? tCurrencies(`${meta.nameKey}.payoutMethod`)
              : account.paymentRail}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-1 font-medium ${badgeClass}`}
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
        {account.canActivate && onActivate ? (
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
        {account.lifecycle === 'active' ? (
          <button
            type="button"
            className="w-fit text-2 font-medium text-accent-11 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onViewDetails();
            }}
          >
            {t('accountCard.viewDetails')}
          </button>
        ) : null}
      </div>
    </Card>
  );
};
