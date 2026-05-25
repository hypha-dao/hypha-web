import type { BankVirtualAccountCurrency } from './hooks/types';

export type BankCurrencyCode = BankVirtualAccountCurrency;

export type BankCurrencyMeta = {
  currency: BankCurrencyCode;
  endorsement: string;
  flagEmoji: string;
  /** i18n key under BankingTab.currencies */
  nameKey: BankCurrencyCode;
};

export const BANK_CURRENCY_METAS: readonly BankCurrencyMeta[] = [
  { currency: 'eur', endorsement: 'sepa', flagEmoji: '🇪🇺', nameKey: 'eur' },
  { currency: 'usd', endorsement: 'base', flagEmoji: '🇺🇸', nameKey: 'usd' },
  {
    currency: 'gbp',
    endorsement: 'faster_payments',
    flagEmoji: '🇬🇧',
    nameKey: 'gbp',
  },
  { currency: 'mxn', endorsement: 'spei', flagEmoji: '🇲🇽', nameKey: 'mxn' },
  { currency: 'brl', endorsement: 'pix', flagEmoji: '🇧🇷', nameKey: 'brl' },
  { currency: 'cop', endorsement: 'cop', flagEmoji: '🇨🇴', nameKey: 'cop' },
] as const;

const DEFAULT_CURRENCY_CODES: BankCurrencyCode[] = ['eur', 'usd'];

export function getDefaultBankCurrencyCodes(): BankCurrencyCode[] {
  return [...DEFAULT_CURRENCY_CODES];
}

export function getBankCurrencyMeta(
  currency: BankCurrencyCode,
): BankCurrencyMeta | undefined {
  return BANK_CURRENCY_METAS.find((m) => m.currency === currency);
}

export function currenciesToEndorsements(
  currencies: BankCurrencyCode[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const code of currencies) {
    const meta = getBankCurrencyMeta(code);
    if (meta && !seen.has(meta.endorsement)) {
      seen.add(meta.endorsement);
      result.push(meta.endorsement);
    }
  }
  return result;
}

export function endorsementToCurrency(
  endorsement: string,
): BankCurrencyCode | null {
  const meta = BANK_CURRENCY_METAS.find((m) => m.endorsement === endorsement);
  return meta?.currency ?? null;
}

/** One-time transfer corridors — mirrors core BANK_TRANSFER_CORRIDORS. */
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

export type BankTransferCorridorMeta = {
  corridorKey: BankTransferCorridorKey;
  currency: BankCurrencyCode;
  paymentRail: string;
};

export const BANK_TRANSFER_CORRIDOR_METAS: readonly BankTransferCorridorMeta[] =
  [
    { corridorKey: 'usd-ach', currency: 'usd', paymentRail: 'ach_push' },
    { corridorKey: 'usd-wire', currency: 'usd', paymentRail: 'wire' },
    { corridorKey: 'eur', currency: 'eur', paymentRail: 'sepa' },
    { corridorKey: 'gbp', currency: 'gbp', paymentRail: 'faster_payments' },
    { corridorKey: 'mxn', currency: 'mxn', paymentRail: 'spei' },
    { corridorKey: 'brl', currency: 'brl', paymentRail: 'pix' },
    { corridorKey: 'cop', currency: 'cop', paymentRail: 'cop' },
  ] as const;

export function getTransferCorridorMeta(
  corridorKey: BankTransferCorridorKey,
): BankTransferCorridorMeta | undefined {
  return BANK_TRANSFER_CORRIDOR_METAS.find(
    (m) => m.corridorKey === corridorKey,
  );
}

export function getTransferCorridorKeyFromStored(
  currency: string,
  paymentRail: string,
): BankTransferCorridorKey | null {
  const normalizedCurrency = currency.toLowerCase();
  const normalizedRail = paymentRail.toLowerCase();

  for (const meta of BANK_TRANSFER_CORRIDOR_METAS) {
    if (
      meta.currency === normalizedCurrency &&
      meta.paymentRail.toLowerCase() === normalizedRail
    ) {
      return meta.corridorKey;
    }
  }

  return null;
}

export function getCorridorForCurrency(currency: BankCurrencyCode): {
  currency: BankCurrencyCode;
  paymentRail: string;
} | null {
  const rails: Record<BankCurrencyCode, string> = {
    eur: 'sepa',
    usd: 'ach',
    gbp: 'faster_payments',
    mxn: 'spei',
    brl: 'pix',
    cop: 'cop',
  };
  const paymentRail = rails[currency];
  if (!paymentRail) {
    return null;
  }
  return { currency, paymentRail };
}
