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

/**
 * Bridge Transfers API source rails (POST /v0/transfers) — differ from virtual account rails.
 * @see https://apidocs.bridge.xyz/platform/orchestration/transfers/transfer
 */
export const BANK_TRANSFER_SOURCE_RAILS: Record<
  BankVirtualAccountCurrency,
  string
> = {
  eur: 'sepa',
  usd: 'ach_push',
  gbp: 'faster_payments',
  mxn: 'spei',
  brl: 'pix',
  cop: 'cop',
};

/** Bridge KYC endorsement ids for each deposit currency. */
export const BANK_CURRENCY_TO_ENDORSEMENT: Record<
  BankVirtualAccountCurrency,
  string
> = {
  eur: 'sepa',
  usd: 'base',
  gbp: 'faster_payments',
  mxn: 'spei',
  brl: 'pix',
  cop: 'cop',
};

export function currenciesToEndorsements(
  currencies: readonly string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const code of currencies) {
    if (
      !(BANK_VIRTUAL_ACCOUNT_CURRENCIES as readonly string[]).includes(code)
    ) {
      continue;
    }
    const endorsement =
      BANK_CURRENCY_TO_ENDORSEMENT[code as BankVirtualAccountCurrency];
    if (!seen.has(endorsement)) {
      seen.add(endorsement);
      result.push(endorsement);
    }
  }
  return result;
}

export function getTransferSourceRailForCurrency(
  currency: string,
): string | null {
  if (
    !(BANK_VIRTUAL_ACCOUNT_CURRENCIES as readonly string[]).includes(currency)
  ) {
    return null;
  }
  return BANK_TRANSFER_SOURCE_RAILS[currency as BankVirtualAccountCurrency];
}

/** Hypha-internal statuses before Bridge resources exist. */
export const BANK_OPERATION_PENDING_KYB = 'pending_kyb' as const;
export const BANK_OPERATION_PENDING_ACTIVATION = 'pending_activation' as const;

export type BankOperationPendingStatus =
  | typeof BANK_OPERATION_PENDING_KYB
  | typeof BANK_OPERATION_PENDING_ACTIVATION;

/** Terminal Bridge transfer states — no further sync needed. */
export const BANK_TRANSFER_TERMINAL_STATES = [
  'payment_processed',
  'canceled',
  'cancelled',
  'failed',
  'returned',
] as const;
