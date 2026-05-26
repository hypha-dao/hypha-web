'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
  type BankTransferCorridorKey,
} from '../bank-currency-display';
import { CurrencyFlagBadge } from './currency-flag-badge';

type BankDepositRailOptionRowProps = {
  mode: 'account' | 'transfer';
  currency: BankCurrencyCode;
  corridorKey?: BankTransferCorridorKey;
  selected: boolean;
  disabled?: boolean;
  radioName: string;
  onSelect: () => void;
};

export const BankDepositRailOptionRow: FC<BankDepositRailOptionRowProps> = ({
  mode,
  currency,
  corridorKey,
  selected,
  disabled = false,
  radioName,
  onSelect,
}) => {
  const tCurrencies = useTranslations('BankingTab.currencies');
  const tCorridors = useTranslations('BankingTab.transferCorridors');
  const currencyMeta = getBankCurrencyMeta(currency);

  const inputId =
    mode === 'transfer' && corridorKey
      ? `transfer-corridor-${corridorKey}`
      : `bank-currency-${currency}`;

  const title =
    mode === 'transfer' && corridorKey
      ? tCorridors(`${corridorKey}.label`)
      : currencyMeta
      ? tCurrencies(`${currencyMeta.nameKey}.code`)
      : currency.toUpperCase();

  const subtitle =
    mode === 'transfer' && corridorKey
      ? tCorridors(`${corridorKey}.hint`)
      : currencyMeta
      ? tCurrencies(`${currencyMeta.nameKey}.payoutMethod`)
      : null;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-colors hover:bg-background-2/80',
        selected ? 'border-accent-9 ring-1 ring-accent-9/30' : 'border-border',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        id={inputId}
        type="radio"
        name={radioName}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect()}
        className="h-4 w-4 shrink-0 accent-accent-9"
      />
      <CurrencyFlagBadge currency={currency} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-2 font-semibold text-foreground">{title}</span>
        {subtitle ? (
          <span className="text-1 text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </label>
  );
};
