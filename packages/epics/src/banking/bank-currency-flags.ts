import type { BankOnboardingCurrencyCode } from './bank-currency-display';

const CURRENCY_TO_COUNTRY: Record<BankOnboardingCurrencyCode, string> = {
  eur: 'EU',
  usd: 'US',
  gbp: 'GB',
  mxn: 'MX',
  brl: 'BR',
  cop: 'CO',
  aud: 'AU',
};

export function getCountryCodeForBankCurrency(
  currency: BankOnboardingCurrencyCode,
): string {
  return CURRENCY_TO_COUNTRY[currency] ?? 'US';
}
