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
