import { describe, expect, it } from 'vitest';

import {
  getDefaultDestinationCurrency,
  getDestinationCurrenciesForSourceRail,
  isAllowedBridgeDestinationCurrency,
} from '../bridge-destination-currencies';

describe('bridge destination currencies', () => {
  it('returns usdc and eurc for sepa in presentation order', () => {
    expect(getDestinationCurrenciesForSourceRail('sepa')).toEqual([
      'usdc',
      'eurc',
    ]);
  });

  it('returns only usdc for ach and wire', () => {
    expect(getDestinationCurrenciesForSourceRail('ach')).toEqual(['usdc']);
    expect(getDestinationCurrenciesForSourceRail('wire')).toEqual(['usdc']);
  });

  it('defaults from source fiat currency when allowed on the rail', () => {
    expect(
      getDefaultDestinationCurrency({
        sourceCurrency: 'eur',
        sourceRail: 'sepa',
      }),
    ).toBe('eurc');
    expect(
      getDefaultDestinationCurrency({
        sourceCurrency: 'usd',
        sourceRail: 'ach_push',
      }),
    ).toBe('usdc');
    expect(
      getDefaultDestinationCurrency({
        sourceCurrency: 'mxn',
        sourceRail: 'spei',
      }),
    ).toBe('usdc');
  });

  it('validates allowed pairs', () => {
    expect(
      isAllowedBridgeDestinationCurrency({
        sourceRail: 'sepa',
        destinationCurrency: 'eurc',
      }),
    ).toBe(true);
    expect(
      isAllowedBridgeDestinationCurrency({
        sourceRail: 'ach',
        destinationCurrency: 'eurc',
      }),
    ).toBe(false);
  });
});
