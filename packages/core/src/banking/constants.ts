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

/** Maps a Bridge endorsement id to the primary deposit currency code. */
export function getCurrencyForEndorsement(endorsement: string): string | null {
  const normalized = endorsement.trim().toLowerCase();
  for (const currency of BANK_VIRTUAL_ACCOUNT_CURRENCIES) {
    if (BANK_CURRENCY_TO_ENDORSEMENT[currency] === normalized) {
      return currency;
    }
  }
  return null;
}

export function mergeRequestedRails(
  current: readonly string[],
  endorsement: string,
): string[] {
  const currency = getCurrencyForEndorsement(endorsement);
  if (!currency) {
    return [...current];
  }
  const normalized = currency.toLowerCase();
  if (current.some((rail) => rail.toLowerCase() === normalized)) {
    return [...current];
  }
  return [...current, normalized];
}

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

/** One-time transfer corridors (UI label + server rail derivation). */
export const BANK_TRANSFER_CORRIDOR_KEYS = [
  'usd-ach',
  'usd-wire',
  'eur',
  'gbp',
  'mxn',
  'brl',
  'cop',
] as const;

export type BankTransferCorridorKey =
  (typeof BANK_TRANSFER_CORRIDOR_KEYS)[number];

export type BankTransferCorridor = {
  currency: BankVirtualAccountCurrency;
  paymentRail: string;
  labelKey: BankTransferCorridorKey;
};

export const BANK_TRANSFER_CORRIDORS: Record<
  BankTransferCorridorKey,
  BankTransferCorridor
> = {
  'usd-ach': { currency: 'usd', paymentRail: 'ach_push', labelKey: 'usd-ach' },
  'usd-wire': { currency: 'usd', paymentRail: 'wire', labelKey: 'usd-wire' },
  eur: { currency: 'eur', paymentRail: 'sepa', labelKey: 'eur' },
  gbp: {
    currency: 'gbp',
    paymentRail: 'faster_payments',
    labelKey: 'gbp',
  },
  mxn: { currency: 'mxn', paymentRail: 'spei', labelKey: 'mxn' },
  brl: { currency: 'brl', paymentRail: 'pix', labelKey: 'brl' },
  cop: { currency: 'cop', paymentRail: 'cop', labelKey: 'cop' },
};

const DEFAULT_TRANSFER_CORRIDOR_BY_CURRENCY: Record<
  BankVirtualAccountCurrency,
  BankTransferCorridorKey
> = {
  eur: 'eur',
  usd: 'usd-ach',
  gbp: 'gbp',
  mxn: 'mxn',
  brl: 'brl',
  cop: 'cop',
};

export function resolveBankTransferCorridor(input: {
  corridorKey?: string;
  currency?: string;
}): {
  corridorKey: BankTransferCorridorKey;
  currency: string;
  paymentRail: string;
} | null {
  if (input.corridorKey) {
    const key = input.corridorKey as BankTransferCorridorKey;
    const corridor = BANK_TRANSFER_CORRIDORS[key];
    if (!corridor) {
      return null;
    }
    return {
      corridorKey: key,
      currency: corridor.currency,
      paymentRail: corridor.paymentRail,
    };
  }

  if (
    input.currency &&
    (BANK_VIRTUAL_ACCOUNT_CURRENCIES as readonly string[]).includes(
      input.currency,
    )
  ) {
    const currency = input.currency as BankVirtualAccountCurrency;
    const corridorKey = DEFAULT_TRANSFER_CORRIDOR_BY_CURRENCY[currency];
    const corridor = BANK_TRANSFER_CORRIDORS[corridorKey];
    return {
      corridorKey,
      currency: corridor.currency,
      paymentRail: corridor.paymentRail,
    };
  }

  return null;
}

export function getTransferCorridorKeyFromStored(
  currency: string,
  paymentRail: string,
): BankTransferCorridorKey | null {
  const normalizedCurrency = currency.toLowerCase();
  const normalizedRail = paymentRail.toLowerCase();

  for (const key of BANK_TRANSFER_CORRIDOR_KEYS) {
    const corridor = BANK_TRANSFER_CORRIDORS[key];
    if (
      corridor.currency === normalizedCurrency &&
      corridor.paymentRail.toLowerCase() === normalizedRail
    ) {
      return key;
    }
  }

  return null;
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
