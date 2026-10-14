import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getEnabledCurrenciesForProvider } from '../enabled-currencies';

const BRIDGE_VAR = 'BANKING_PROVIDER_ENABLED_CURRENCIES_BRIDGE';
const AUDD_VAR = 'BANKING_PROVIDER_ENABLED_CURRENCIES_AUDD';

afterEach(() => {
  delete process.env[BRIDGE_VAR];
  delete process.env[AUDD_VAR];
});

describe('getEnabledCurrenciesForProvider', () => {
  it('is permissive when the env var is unset — returns all manifest currencies', () => {
    delete process.env[BRIDGE_VAR];
    expect(getEnabledCurrenciesForProvider('bridge').sort()).toEqual(
      ['brl', 'cop', 'eur', 'gbp', 'mxn', 'usd'].sort(),
    );
    expect(getEnabledCurrenciesForProvider('audd')).toEqual(['aud']);
  });

  it('narrows to the listed subset when the env var is set', () => {
    process.env[BRIDGE_VAR] = 'usd, eur';
    expect(getEnabledCurrenciesForProvider('bridge')).toEqual(['usd', 'eur']);
  });

  it('lower-cases and trims entries', () => {
    process.env[BRIDGE_VAR] = ' USD , Eur ';
    expect(getEnabledCurrenciesForProvider('bridge')).toEqual(['usd', 'eur']);
  });

  it('treats an explicit empty string as "no currencies" (disabled)', () => {
    process.env[AUDD_VAR] = '';
    expect(getEnabledCurrenciesForProvider('audd')).toEqual([]);
  });

  it('treats a whitespace/comma-only value as "no currencies"', () => {
    process.env[AUDD_VAR] = ' , ,';
    expect(getEnabledCurrenciesForProvider('audd')).toEqual([]);
  });
});
