'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@hypha-platform/ui';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { getCardDepositCopyBlock } from '../deposit-instruction-display';
import type { BankVirtualAccountPublic } from '../hooks/types';
import { InlineCopyRow } from './inline-copy-row';
import { CurrencyFlagBadge } from './currency-flag-badge';

type BankAccountCardProps = {
  account: BankVirtualAccountPublic;
  onViewDetails: () => void;
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
}) => {
  const t = useTranslations('BankingTab');
  const tFields = useTranslations('BankingTab.depositInstructions');
  const tCurrencies = useTranslations('BankingTab.currencies');
  const currency = accountToCurrency(account);
  const meta = getBankCurrencyMeta(currency);

  const cardCopyBlock = getCardDepositCopyBlock(
    account.paymentRail,
    account.depositInstructions,
    (key) => tFields(key),
  );

  return (
    <Card
      className="flex h-full cursor-pointer flex-col gap-3 p-5 transition-colors hover:bg-background-2/50"
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
        <span className="rounded-full bg-success-9 px-2 py-0.5 text-1 font-medium text-white">
          {t('depositInstructions.activeBadge')}
        </span>
      </div>

      {cardCopyBlock ? (
        <InlineCopyRow
          className="flex-1"
          label={cardCopyBlock.label}
          value={cardCopyBlock.copyText}
          multiline={cardCopyBlock.multiline}
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
        {t('accountCard.viewDetails')}
      </button>
    </Card>
  );
};
