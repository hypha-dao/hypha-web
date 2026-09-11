import { describe, expect, it } from 'vitest';
import {
  CURRENCY_FEED_OPTIONS,
  CURRENCY_FEEDS,
  encodeOnChainTokenPrice,
  getPriceCurrencyFeed,
  hasOnChainCurrencyFeed,
} from '../token-backing-vault';

describe('CURRENCY_FEEDS', () => {
  it('does not invent an AggregatorV3 feed for TZS', () => {
    expect(CURRENCY_FEEDS).not.toHaveProperty('TZS');
    expect(CURRENCY_FEED_OPTIONS.some((option) => option.label === 'TZS')).toBe(
      false,
    );
  });
});

describe('hasOnChainCurrencyFeed', () => {
  it('accepts wired feeds and rejects display-only TZS', () => {
    expect(hasOnChainCurrencyFeed('USD')).toBe(true);
    expect(hasOnChainCurrencyFeed('EUR')).toBe(true);
    expect(hasOnChainCurrencyFeed('TZS')).toBe(false);
    expect(hasOnChainCurrencyFeed('JPY')).toBe(false);
    expect(hasOnChainCurrencyFeed(undefined)).toBe(false);
  });
});

describe('getPriceCurrencyFeed', () => {
  it('returns address(0) for USD and the EUR feed for EUR', () => {
    expect(getPriceCurrencyFeed('USD')).toBe(CURRENCY_FEEDS.USD);
    expect(getPriceCurrencyFeed('EUR')).toBe(CURRENCY_FEEDS.EUR);
  });

  it('does not fall back to a USD feed for TZS', () => {
    expect(getPriceCurrencyFeed('TZS')).toBeUndefined();
    expect(getPriceCurrencyFeed('JPY')).toBeUndefined();
    expect(getPriceCurrencyFeed(undefined)).toBeUndefined();
  });
});

describe('encodeOnChainTokenPrice', () => {
  it('writes a non-zero USD micro-price with address(0)', () => {
    expect(
      encodeOnChainTokenPrice({
        referencePrice: 2.5,
        referenceCurrency: 'USD',
      }),
    ).toEqual({
      tokenPrice: 2_500_000,
      priceCurrencyFeed: CURRENCY_FEEDS.USD,
    });
  });

  it('writes a non-zero EUR micro-price with the EUR feed', () => {
    expect(
      encodeOnChainTokenPrice({
        referencePrice: 1,
        referenceCurrency: 'EUR',
      }),
    ).toEqual({
      tokenPrice: 1_000_000,
      priceCurrencyFeed: CURRENCY_FEEDS.EUR,
    });
  });

  it('does not claim a USD peg when the labelled currency is TZS', () => {
    expect(
      encodeOnChainTokenPrice({
        referencePrice: 2500,
        referenceCurrency: 'TZS',
      }),
    ).toEqual({
      tokenPrice: 0,
      priceCurrencyFeed: CURRENCY_FEEDS.USD,
    });
  });

  it('clears on-chain price when pricing is off or invalid', () => {
    expect(encodeOnChainTokenPrice({})).toEqual({
      tokenPrice: 0,
      priceCurrencyFeed: CURRENCY_FEEDS.USD,
    });
    expect(
      encodeOnChainTokenPrice({
        referencePrice: 0,
        referenceCurrency: 'USD',
      }),
    ).toEqual({
      tokenPrice: 0,
      priceCurrencyFeed: CURRENCY_FEEDS.USD,
    });
  });
});
