import type { BankCurrencyCode } from './bank-currency-display';

const CURRENCY_TO_COUNTRY: Record<BankCurrencyCode, string> = {
  eur: 'EU',
  usd: 'US',
  gbp: 'GB',
  mxn: 'MX',
  brl: 'BR',
  cop: 'CO',
};

export function getCountryCodeForBankCurrency(
  currency: BankCurrencyCode,
): string {
  return CURRENCY_TO_COUNTRY[currency] ?? 'US';
}
