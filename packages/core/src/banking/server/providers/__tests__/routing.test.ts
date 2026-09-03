import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { BankOnboardingError } from '../../errors';
import {
  resolveProviderForCurrency,
  resolveProviderForRails,
} from '../routing';

const BRIDGE_VAR = 'BANKING_PROVIDER_ENABLED_CURRENCIES_BRIDGE';
const AUDD_VAR = 'BANKING_PROVIDER_ENABLED_CURRENCIES_AUDD';

afterEach(() => {
  delete process.env[BRIDGE_VAR];
  delete process.env[AUDD_VAR];
});

describe('resolveProviderForCurrency', () => {
  it('routes a Bridge currency to bridge (permissive default)', () => {
    expect(resolveProviderForCurrency('usd')).toBe('bridge');
    expect(resolveProviderForCurrency('EUR')).toBe('bridge');
  });

  it('routes aud to audd (permissive default)', () => {
    expect(resolveProviderForCurrency('aud')).toBe('audd');
  });

  it('throws on a currency no enabled provider supports (D4 — no Bridge fallback)', () => {
    try {
      resolveProviderForCurrency('kes');
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BankOnboardingError);
      expect((error as BankOnboardingError).status).toBe(422);
    }
  });

  it('throws when the Enablement env narrows the currency out', () => {
    process.env[AUDD_VAR] = ''; // AUDD disabled
    expect(() => resolveProviderForCurrency('aud')).toThrow(BankOnboardingError);
  });

  it('still routes Bridge currencies when only AUDD is narrowed', () => {
    process.env[AUDD_VAR] = 'aud';
    process.env[BRIDGE_VAR] = 'usd,eur';
    expect(resolveProviderForCurrency('usd')).toBe('bridge');
    expect(() => resolveProviderForCurrency('gbp')).toThrow(BankOnboardingError);
  });
});

describe('resolveProviderForRails', () => {
  it('resolves a single-provider rail set', () => {
    expect(resolveProviderForRails(['aud'])).toBe('audd');
    expect(resolveProviderForRails(['usd', 'eur'])).toBe('bridge');
  });

  it('rejects a mixed-provider rail set (D3)', () => {
    try {
      resolveProviderForRails(['usd', 'aud']);
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BankOnboardingError);
      expect((error as BankOnboardingError).message).toMatch(
        /multiple bank providers/,
      );
    }
  });

  it('rejects an empty rail set', () => {
    expect(() => resolveProviderForRails([])).toThrow(BankOnboardingError);
  });

  it('propagates the unresolved-currency throw', () => {
    expect(() => resolveProviderForRails(['usd', 'kes'])).toThrow(
      BankOnboardingError,
    );
  });
});
