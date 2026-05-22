'use client';

import { FC } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@hypha-platform/ui';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { CurrencyFlagBadge } from './currency-flag-badge';

type CurrencyOptionRowProps = {
  currency: BankCurrencyCode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export const CurrencyOptionRow: FC<CurrencyOptionRowProps> = ({
  currency,
  checked,
  disabled = false,
  onCheckedChange,
}) => {
  const t = useTranslations('BankingTab.currencies');
  const meta = getBankCurrencyMeta(currency);
  if (!meta) {
    return null;
  }

  const inputId = `bank-currency-${currency}`;

  return (
    <label
      htmlFor={inputId}
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:bg-background-2/80 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
    >
      <Checkbox
        id={inputId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <CurrencyFlagBadge currency={currency} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-2 font-semibold text-foreground">
          {t(`${meta.nameKey}.code`)}
        </span>
        <span className="text-1 text-muted-foreground">
          {t(`${meta.nameKey}.payoutMethod`)}
        </span>
      </span>
    </label>
  );
};
