export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'CAD',
  'CHF',
  'AUD',
  'NZD',
  'HKD',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = 'USD';

export const CURRENCY_OPTIONS: Array<{
  value: SupportedCurrency;
  label: string;
}> = [
  { value: 'USD', label: 'USD - United States Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
];

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  CAD: 'C$',
  CHF: 'CHF',
  AUD: 'A$',
  NZD: 'NZ$',
  HKD: 'HK$',
};

export const isSupportedCurrency = (
  currency?: string | null,
): currency is SupportedCurrency =>
  !!currency &&
  SUPPORTED_CURRENCIES.includes(
    currency as (typeof SUPPORTED_CURRENCIES)[number],
  );

export const resolveSupportedCurrency = (
  currency?: string | null,
): SupportedCurrency =>
  isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY;

export const getCurrencySymbol = (currency?: string | null): string =>
  CURRENCY_SYMBOLS[resolveSupportedCurrency(currency)];
