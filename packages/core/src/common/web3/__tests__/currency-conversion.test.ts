import { describe, expect, it, vi } from 'vitest';
import {
  CONVERTIBLE_CURRENCIES,
  convertFromUsd,
  convertToUsd,
  isConvertibleCurrency,
  type UsdRates,
} from '../currency-conversion';
import { CURRENCY_FEEDS } from '../token-backing-vault';
import { TOKEN_PRICE_REFERENCE_CURRENCIES } from '../../../governance/types';

const RATES: UsdRates = { USD: 1, AUD: 0.65, EUR: 1.08 };

describe('CONVERTIBLE_CURRENCIES', () => {
  it('stays in step with the currencies a token can be priced in', () => {
    expect([...CONVERTIBLE_CURRENCIES].sort()).toEqual(
      [...TOKEN_PRICE_REFERENCE_CURRENCIES].sort(),
    );
  });

  it('covers every wired Chainlink feed', () => {
    expect(CONVERTIBLE_CURRENCIES).toEqual(Object.keys(CURRENCY_FEEDS));
  });
});

describe('isConvertibleCurrency', () => {
  it('accepts currencies with a feed and rejects everything else', () => {
    expect(isConvertibleCurrency('AUD')).toBe(true);
    expect(isConvertibleCurrency('USD')).toBe(true);
    // No Chainlink feed on Base.
    expect(isConvertibleCurrency('JPY')).toBe(false);
    expect(isConvertibleCurrency('aud')).toBe(false);
    expect(isConvertibleCurrency(null)).toBe(false);
    expect(isConvertibleCurrency(undefined)).toBe(false);
  });
});

describe('convertToUsd', () => {
  it('values an AUD-priced holding in USD', () => {
    // The bug Alex hit: 4,050,000 tokens at 1.00 AUD were counted as USD.
    expect(convertToUsd(4_050_000, 'AUD', RATES)).toBeCloseTo(2_632_500, 6);
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

  it('passes the amount through when no rate is available', () => {
    expect(convertFromUsd(100, 'JPY', RATES)).toBe(100);
    expect(convertFromUsd(100, 'AUD', {})).toBe(100);
    expect(convertFromUsd(100, 'AUD', { AUD: 0 })).toBe(100);
  });

  it('preserves sign for negative balances', () => {
    expect(convertFromUsd(-65, 'AUD', RATES)).toBeCloseTo(-100, 6);
  });
});
