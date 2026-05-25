'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import {
  getBankCurrencyMeta,
  getTransferCorridorMeta,
  type BankTransferCorridorKey,
} from '../bank-currency-display';
import { CurrencyFlagBadge } from './currency-flag-badge';

type TransferCorridorOptionRowProps = {
  corridorKey: BankTransferCorridorKey;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export const TransferCorridorOptionRow: FC<TransferCorridorOptionRowProps> = ({
  corridorKey,
  selected,
  disabled = false,
  onSelect,
}) => {
  const t = useTranslations('BankingTab.transferCorridors');
  const meta = getTransferCorridorMeta(corridorKey);
  if (!meta) {
    return null;
  }

  const currencyMeta = getBankCurrencyMeta(meta.currency);
  const inputId = `transfer-corridor-${corridorKey}`;

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
        name="transfer-corridor"
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect()}
        className="h-4 w-4 shrink-0 accent-accent-9"
      />
      <CurrencyFlagBadge currency={meta.currency} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-2 font-semibold text-foreground">
          {t(`${corridorKey}.label`)}
        </span>
        {currencyMeta ? (
          <span className="text-1 text-muted-foreground">
            {t(`${corridorKey}.hint`)}
          </span>
        ) : null}
      </span>
    </label>
  );
};
