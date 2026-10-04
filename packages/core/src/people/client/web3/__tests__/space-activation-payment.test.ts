import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { TOKENS } from '../../../../common/web3/tokens';
import { schemaActivateSpaces } from '../../../../governance/validation';
import {
  assertOnChainSpaceRenewalSupported,
  convertUsdToEurc,
  EURC_BASE_ADDRESS,
  EURC_NOT_SUPPORTED_ONCHAIN_CODE,
  EURC_RATE_UNAVAILABLE_CODE,
  getCatalogueEurcAddress,
  getSpaceActivationBreakdown,
  getSpaceActivationHyphaAmount,
  getSpaceActivationPaymentAmounts,
  getSpaceActivationTotal,
  getSpaceActivationUsdAmount,
  isOnChainSpaceRenewalToken,
  isSpaceActivationPaymentToken,
  resolveSpaceActivationTokenAddress,
} from '../space-activation-payment';

const SPACES = [
  { spaceId: 12, months: 1 },
  { spaceId: 34, months: 2 },
];

describe('EURC catalogue address', () => {
  it('matches Circle EURC on Base', () => {
    expect(getCatalogueEurcAddress()).toBe(EURC_BASE_ADDRESS);
    expect(getAddress(EURC_BASE_ADDRESS)).toBe(EURC_BASE_ADDRESS);
    expect(TOKENS.find((token) => token.symbol === 'EURC')?.address).toBe(
      '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    );
  });
});

describe('space activation pricing', () => {
  it('keeps the USDC monthly price at $11 (44 HYPHA × $0.25)', () => {
    expect(getSpaceActivationHyphaAmount(1)).toBe(44);
    expect(getSpaceActivationUsdAmount(1)).toBe(11);
    expect(getSpaceActivationUsdAmount(2)).toBe(22);
  });

  it('does not change USDC totals when an EUR rate is present', () => {
    const withoutFx = getSpaceActivationBreakdown(SPACES);
    const withFx = getSpaceActivationBreakdown(SPACES, { EUR: 1.08 });

    expect(withoutFx.totalUSDC).toBe(33);
    expect(withFx.totalUSDC).toBe(33);
    expect(withoutFx.totalHYPHA).toBe(132);
    expect(withFx.totalHYPHA).toBe(132);
    expect(getSpaceActivationPaymentAmounts(withFx, 'USDC')).toEqual([11, 22]);
    expect(getSpaceActivationPaymentAmounts(withFx, 'HYPHA')).toEqual([44, 88]);
  });

  it('converts USD prices to EURC with the Chainlink EUR/USD rate', () => {
    expect(convertUsdToEurc(11, 1.08)).toBeCloseTo(10.1852, 4);
    const breakdown = getSpaceActivationBreakdown(SPACES, { EUR: 1.08 });
    expect(breakdown.totalEURC).toBeCloseTo(30.5556, 4);
    expect(getSpaceActivationPaymentAmounts(breakdown, 'EURC')[0]).toBeCloseTo(
      10.1852,
      4,
    );
    expect(getSpaceActivationTotal(breakdown, 'EURC')).toBeCloseTo(30.5556, 4);
  });

  it('does not invent a 1:1 EURC price when the FX rate is missing', () => {
    expect(convertUsdToEurc(11, undefined)).toBeUndefined();
    expect(convertUsdToEurc(11, 0)).toBeUndefined();
    expect(convertUsdToEurc(11, -1)).toBeUndefined();
    const breakdown = getSpaceActivationBreakdown(SPACES, {});
    expect(breakdown.totalEURC).toBeUndefined();
    expect(breakdown.items.every((item) => item.eurc === undefined)).toBe(true);
    expect(() => getSpaceActivationPaymentAmounts(breakdown, 'EURC')).toThrow(
      EURC_RATE_UNAVAILABLE_CODE,
    );
  });
});

describe('on-chain renewal token support', () => {
  it('accepts HYPHA and USDC, and rejects EURC for on-chain payment', () => {
    expect(isSpaceActivationPaymentToken('EURC')).toBe(true);
    expect(isOnChainSpaceRenewalToken('USDC')).toBe(true);
    expect(isOnChainSpaceRenewalToken('HYPHA')).toBe(true);
    expect(isOnChainSpaceRenewalToken('EURC')).toBe(false);
    expect(() => assertOnChainSpaceRenewalSupported('USDC')).not.toThrow();
    expect(() => assertOnChainSpaceRenewalSupported('EURC')).toThrow(
      EURC_NOT_SUPPORTED_ONCHAIN_CODE,
    );
  });

  it('resolves catalogue addresses for USDC and EURC', () => {
    const hypha = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
    expect(resolveSpaceActivationTokenAddress('HYPHA', hypha)).toBe(hypha);
    expect(resolveSpaceActivationTokenAddress('USDC', hypha)).toBe(
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    );
    expect(resolveSpaceActivationTokenAddress('EURC', hypha)).toBe(
      EURC_BASE_ADDRESS,
    );
  });
});

describe('schemaActivateSpaces', () => {
  const base = {
    title: 'Renew',
    description: 'Pay subscription',
    creatorId: 1,
    spaceId: 1,
    label: 'Activate Spaces' as const,
    recipient: '0x695f21B04B22609c4ab9e5886EB0F65cDBd464B6',
    spaces: [{ spaceId: 12, months: 1 }],
  };

  it('accepts EURC as a payment token on the form schema', () => {
    expect(
      schemaActivateSpaces.parse({ ...base, paymentToken: 'EURC' })
        .paymentToken,
    ).toBe('EURC');
    expect(
      schemaActivateSpaces.parse({ ...base, paymentToken: 'USDC' })
        .paymentToken,
    ).toBe('USDC');
  });

  it('rejects unknown payment tokens', () => {
    expect(() =>
      schemaActivateSpaces.parse({ ...base, paymentToken: 'AUDD' }),
    ).toThrow();
  });
});
