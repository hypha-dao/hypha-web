'use client';

import { FC } from 'react';
import EU from 'country-flag-icons/react/3x2/EU';
import US from 'country-flag-icons/react/3x2/US';
import GB from 'country-flag-icons/react/3x2/GB';
import MX from 'country-flag-icons/react/3x2/MX';
import BR from 'country-flag-icons/react/3x2/BR';
import CO from 'country-flag-icons/react/3x2/CO';

import {
  getBankCurrencyMeta,
  type BankCurrencyCode,
} from '../bank-currency-display';
import { getCountryCodeForBankCurrency } from '../bank-currency-flags';

type CurrencyFlagBadgeProps = {
  currency: BankCurrencyCode;
  size?: 'sm' | 'md';
  className?: string;
};

const FLAG_COMPONENTS: Record<string, FC<{ className?: string }>> = {
  EU,
  US,
  GB,
  MX,
  BR,
  CO,
};

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
} as const;

export const CurrencyFlagBadge: FC<CurrencyFlagBadgeProps> = ({
  currency,
  size = 'md',
  className = '',
}) => {
  const countryCode = getCountryCodeForBankCurrency(currency);
  const Flag = FLAG_COMPONENTS[countryCode];
  const meta = getBankCurrencyMeta(currency);

  if (Flag) {
    return (
      <span
        className={`relative inline-flex shrink-0 overflow-hidden rounded-full border border-border ${sizeClasses[size]} ${className}`}
        aria-hidden
      >
        {/* 3×2 flags: scale by height so the circle is filled without letterboxing */}
        <Flag className="absolute left-1/2 top-1/2 h-full w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 [&_svg]:h-full [&_svg]:w-full" />
      </span>
    );
  }

  const emoji = meta?.flagEmoji ?? '🏦';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-background-2 text-lg ${sizeClasses[size]} ${className}`}
      aria-hidden
    >
      {emoji}
    </span>
  );
};
