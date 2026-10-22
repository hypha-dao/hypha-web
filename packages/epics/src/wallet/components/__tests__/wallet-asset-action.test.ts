import { describe, expect, it } from 'vitest';
import { walletAssetActionHref } from '../wallet-asset-action';

const HYPHA = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

describe('walletAssetActionHref', () => {
  it('opens buy for HYPHA even when the balance is zero', () => {
    expect(
      walletAssetActionHref('/en/my-wallet', {
        address: HYPHA,
        symbol: 'HYPHA',
        type: 'utility',
        value: 0,
      }),
    ).toBe('/en/my-wallet/actions/purchase-hypha-tokens');
  });

  it('opens send for another token that has a balance', () => {
    expect(
      walletAssetActionHref('/en/my-wallet', {
        address: USDC,
        symbol: 'USDC',
        type: 'utility',
        value: 12,
      }),
    ).toBe(`/en/my-wallet/actions/transfer-funds?token=${USDC}`);
  });

  it('does not open send for another token with an empty balance', () => {
    expect(
      walletAssetActionHref('/en/my-wallet', {
        address: USDC,
        symbol: 'USDC',
        type: 'utility',
        value: 0,
      }),
    ).toBeNull();
  });
});
