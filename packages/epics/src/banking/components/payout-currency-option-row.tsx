'use client';

import { FC } from 'react';
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { CurrencyFlagBadge } from './currency-flag-badge';

export type PayoutCurrencyKey = 'usd' | 'eur' | 'gbp' | 'swift';

type PayoutCurrencyOptionRowProps = {
  currency: PayoutCurrencyKey;
  selected: boolean;
  disabled?: boolean;
  radioName: string;
  onSelect: () => void;
};

export function payoutCurrencyToRailKey(
  currency: PayoutCurrencyKey,
): 'usd_ach' | 'eur_sepa' | 'gbp' | 'swift' {
  switch (currency) {
    case 'usd':
      return 'usd_ach';
    case 'eur':
      return 'eur_sepa';
    case 'gbp':
      return 'gbp';
    case 'swift':
      return 'swift';
  }
}

export const PAYOUT_CURRENCY_KEYS: PayoutCurrencyKey[] = [
  'usd',
  'eur',
  'gbp',
  'swift',
];

/**
 * Returns the subset of PAYOUT_CURRENCY_KEYS whose mapped rail key appears in
 * NEXT_PUBLIC_BANKING_SUPPORTED_PAYOUT_RAILS. When the env var is unset or
 * empty all currencies are considered enabled (open-world default).
 */
export function getEnabledPayoutCurrencyKeys(): PayoutCurrencyKey[] {
  const raw = process.env.NEXT_PUBLIC_BANKING_SUPPORTED_PAYOUT_RAILS?.trim();
  if (!raw) return PAYOUT_CURRENCY_KEYS;
  const allowed = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  return PAYOUT_CURRENCY_KEYS.filter((c) => allowed.has(payoutCurrencyToRailKey(c)));
}

/**
 * Source stablecoins accepted by Bridge for each payout rail.
 * Keep in sync with Bridge Route Explorer (base → destination rail).
 * USD ACH/Wire: USDC only (no EURC→USD route).
 * EUR SEPA: both USDC and EURC (EURC is default, matches on-ramp behavior).
 * GBP FPS / SWIFT: USDC only — verify against Bridge Route Explorer if adding EURC support.
 */
export const PAYOUT_RAIL_SOURCE_CURRENCIES: Record<
  PayoutCurrencyKey,
  ('usdc' | 'eurc')[]
> = {
  usd: ['usdc'],
  eur: ['usdc', 'eurc'],
  gbp: ['usdc'],
  swift: ['usdc'],
};

export const PayoutCurrencyOptionRow: FC<PayoutCurrencyOptionRowProps> = ({
  currency,
  selected,
  disabled = false,
  radioName,
  onSelect,
}) => {
  const tCurrencies = useTranslations('BankingTab.currencies');
  const tDialog = useTranslations('BankingTab.payouts.addDialog');

  const inputId = `payout-currency-${currency}`;
  const isSwift = currency === 'swift';
  const bankCurrency = isSwift ? null : (currency as BankCurrencyCode);
  const currencyMeta = bankCurrency ? getBankCurrencyMeta(bankCurrency) : null;

  const title = isSwift
    ? tDialog('swift.code')
    : currencyMeta
    ? tCurrencies(`${currencyMeta.nameKey}.code`)
    : currency.toUpperCase();

  const subtitle = isSwift
    ? tDialog('swift.hint')
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
      {isSwift ? (
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background-2 text-muted-foreground"
          aria-hidden
        >
          <Globe className="h-6 w-6" strokeWidth={1.75} />
        </span>
      ) : bankCurrency ? (
        <CurrencyFlagBadge currency={bankCurrency} size="sm" />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-2 font-semibold text-foreground">{title}</span>
        {subtitle ? (
          <span className="text-1 text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </label>
  );
};
