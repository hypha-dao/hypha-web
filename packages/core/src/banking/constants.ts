import type { BankProvider } from './types';

/** Default banking provider for space onboarding (Stage 1). */
export const DEFAULT_BANK_PROVIDER: BankProvider = 'bridge';

/** Source currencies supported for Bridge virtual accounts (Stage 2). */
export const BANK_VIRTUAL_ACCOUNT_CURRENCIES = [
  'eur',
  'usd',
  'gbp',
  'mxn',
  'brl',
  'cop',
] as const;

export type BankVirtualAccountCurrency =
  (typeof BANK_VIRTUAL_ACCOUNT_CURRENCIES)[number];

/** API currency input → payment rail stored for idempotency. */
export const BANK_VIRTUAL_ACCOUNT_CURRENCY_TO_RAIL: Record<
  BankVirtualAccountCurrency,
  string
> = {
  eur: 'sepa',
  usd: 'ach',
  gbp: 'faster_payments',
  mxn: 'spei',
  brl: 'pix',
  cop: 'cop',
};

export function getPaymentRailForCurrency(currency: string): string | null {
  if (
    !(BANK_VIRTUAL_ACCOUNT_CURRENCIES as readonly string[]).includes(currency)
  ) {
    return null;
  }
  return BANK_VIRTUAL_ACCOUNT_CURRENCY_TO_RAIL[
    currency as BankVirtualAccountCurrency
  ];
}
