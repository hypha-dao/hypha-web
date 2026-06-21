import { describe, expect, it } from 'vitest';
import { computeTokenPriceInUsd } from '../treasury-pricing';

const ratesToUsd = {
  USD: 1,
  EUR: 1.1,
  GBP: 1.25,
  CAD: 0.72,
  CHF: 1.15,
  AUD: 0.65,
};

describe('computeTokenPriceInUsd', () => {
  it('prefers market price when available', () => {
    expect(
      computeTokenPriceInUsd({
        marketPriceUsd: 2.5,
        referencePrice: 10,
        referenceCurrency: 'EUR',
        ratesToUsd,
      }),
    ).toBe(2.5);
  });

  it('converts reference price from EUR to USD', () => {
    expect(
      computeTokenPriceInUsd({
        marketPriceUsd: 0,
        referencePrice: 10,
        referenceCurrency: 'EUR',
        ratesToUsd,
      }),
    ).toBe(11);
  });

  it('treats USD reference price as already in USD', () => {
    expect(
      computeTokenPriceInUsd({
        marketPriceUsd: 0,
        referencePrice: 5,
        referenceCurrency: 'USD',
        ratesToUsd,
      }),
    ).toBe(5);
  });

  it('returns 0 when no price is available', () => {
    expect(
      computeTokenPriceInUsd({
        marketPriceUsd: 0,
        referencePrice: undefined,
        referenceCurrency: 'USD',
        ratesToUsd,
      }),
    ).toBe(0);
  });
});
