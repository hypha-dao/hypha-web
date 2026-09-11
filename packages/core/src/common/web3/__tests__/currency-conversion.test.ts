import { describe, expect, it, vi } from 'vitest';
import {
  applyLastKnownOffchainRates,
  CONVERTIBLE_CURRENCIES,
  convertFromUsd,
  convertToUsd,
  isConvertibleCurrency,
  OFFCHAIN_USD_CURRENCIES,
  usdRateFromCoingeckoBtcQuotes,
  type UsdRates,
} from '../currency-conversion';
import { CURRENCY_FEEDS } from '../token-backing-vault';
import { TOKEN_PRICE_REFERENCE_CURRENCIES } from '../../../governance/types';

const RATES: UsdRates = { USD: 1, AUD: 0.65, EUR: 1.08, TZS: 1 / 2_650 };

describe('CONVERTIBLE_CURRENCIES', () => {
  it('stays in step with the currencies a token can be priced in', () => {
    expect([...CONVERTIBLE_CURRENCIES].sort()).toEqual(
      [...TOKEN_PRICE_REFERENCE_CURRENCIES].sort(),
    );
  });

  it('covers every wired Chainlink feed plus off-chain convertibles', () => {
    expect(CONVERTIBLE_CURRENCIES).toEqual([
      ...Object.keys(CURRENCY_FEEDS),
      ...OFFCHAIN_USD_CURRENCIES,
    ]);
    expect(OFFCHAIN_USD_CURRENCIES).toEqual(['TZS']);
  });
});

describe('isConvertibleCurrency', () => {
  it('accepts on-chain feeds and off-chain TZS, and rejects everything else', () => {
    expect(isConvertibleCurrency('AUD')).toBe(true);
    expect(isConvertibleCurrency('USD')).toBe(true);
    expect(isConvertibleCurrency('TZS')).toBe(true);
    // No Chainlink feed on Base and no off-chain rate.
    expect(isConvertibleCurrency('JPY')).toBe(false);
    expect(isConvertibleCurrency('aud')).toBe(false);
    expect(isConvertibleCurrency(null)).toBe(false);
    expect(isConvertibleCurrency(undefined)).toBe(false);
  });

  it('rejects inherited object keys', () => {
    expect(isConvertibleCurrency('constructor')).toBe(false);
    expect(isConvertibleCurrency('toString')).toBe(false);
    expect(isConvertibleCurrency('hasOwnProperty')).toBe(false);
    expect(isConvertibleCurrency('__proto__')).toBe(false);
  });
});

describe('convertToUsd', () => {
  it('values an AUD-priced holding in USD', () => {
    // The bug Alex hit: 4,050,000 tokens at 1.00 AUD were counted as USD.
    expect(convertToUsd(4_050_000, 'AUD', RATES)).toBeCloseTo(2_632_500, 6);
  });

  it('values a TZS-priced holding in USD instead of treating TZS as 1:1', () => {
    expect(convertToUsd(2_650, 'TZS', RATES)).toBeCloseTo(1, 6);
  });

  it('omits TZS from the USD total when no rate is available', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(convertToUsd(2_650, 'TZS', {})).toBe(0);
    expect(convertToUsd(2_650, 'TZS', { TZS: 0 })).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves USD amounts untouched', () => {
    expect(convertToUsd(100, 'USD', RATES)).toBe(100);
    expect(convertToUsd(100, null, RATES)).toBe(100);
    expect(convertToUsd(100, undefined, RATES)).toBe(100);
  });

  it('falls back to 1:1 rather than zeroing an unpriceable balance', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(convertToUsd(100, 'JPY', RATES)).toBe(100);
    expect(convertToUsd(100, 'AUD', {})).toBe(100);
    expect(convertToUsd(100, 'AUD', { AUD: 0 })).toBe(100);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('treats non-finite and zero amounts as zero', () => {
    expect(convertToUsd(0, 'AUD', RATES)).toBe(0);
    expect(convertToUsd(Number.NaN, 'AUD', RATES)).toBe(0);
    expect(convertToUsd(Number.POSITIVE_INFINITY, 'AUD', RATES)).toBe(0);
  });

  it('does not let an inherited key name poison the total with NaN', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // reference_currency is free text, so these can reach us from the DB.
    for (const key of ['constructor', 'toString', 'hasOwnProperty']) {
      expect(convertToUsd(100, key, RATES)).toBe(100);
      expect(convertFromUsd(100, key, RATES)).toBe(100);
    }
    warn.mockRestore();
  });
});

describe('convertFromUsd', () => {
  it('renders a USD total in the member currency', () => {
    expect(convertFromUsd(2_632_500, 'AUD', RATES)).toBeCloseTo(4_050_000, 6);
  });

  it('round-trips with convertToUsd', () => {
    const original = 1234.56;
    expect(
      convertFromUsd(convertToUsd(original, 'EUR', RATES), 'EUR', RATES),
    ).toBeCloseTo(original, 9);
  });

  it('passes the amount through when no on-chain rate is available', () => {
    expect(convertFromUsd(100, 'JPY', RATES)).toBe(100);
    expect(convertFromUsd(100, 'AUD', {})).toBe(100);
    expect(convertFromUsd(100, 'AUD', { AUD: 0 })).toBe(100);
  });

  it('does not treat a missing TZS rate as 1:1 USD', () => {
    expect(convertFromUsd(1, 'TZS', {})).toBe(0);
    expect(convertFromUsd(1, 'TZS', { TZS: 0 })).toBe(0);
  });

  it('preserves sign for negative balances', () => {
    expect(convertFromUsd(-65, 'AUD', RATES)).toBeCloseTo(-100, 6);
  });
});

describe('applyLastKnownOffchainRates', () => {
  it('fills a missing TZS quote from the last validated rate', () => {
    expect(
      applyLastKnownOffchainRates({ USD: 1 }, { TZS: 1 / 2_650 }).TZS,
    ).toBeCloseTo(1 / 2_650, 12);
  });

  it('does not overwrite a live TZS quote', () => {
    expect(
      applyLastKnownOffchainRates({ TZS: 0.0004 }, { TZS: 0.0003 }).TZS,
    ).toBe(0.0004);
  });
});

describe('usdRateFromCoingeckoBtcQuotes', () => {
  it('derives USD per 1 TZS from the BTC dual quote', () => {
    expect(
      usdRateFromCoingeckoBtcQuotes({ usd: 100_000, tzs: 265_000_000 }),
    ).toBeCloseTo(100_000 / 265_000_000, 12);
  });

  it('rejects missing or non-positive quotes', () => {
    expect(usdRateFromCoingeckoBtcQuotes({})).toBeUndefined();
    expect(usdRateFromCoingeckoBtcQuotes({ usd: 100_000 })).toBeUndefined();
    expect(
      usdRateFromCoingeckoBtcQuotes({ usd: 100_000, tzs: 0 }),
    ).toBeUndefined();
    expect(
      usdRateFromCoingeckoBtcQuotes({ usd: Number.NaN, tzs: 1 }),
    ).toBeUndefined();
  });
});
