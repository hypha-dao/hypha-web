import { describe, expect, it } from 'vitest';
import {
  buildWalletSectionNavItems,
  isWalletSectionNavActive,
} from '../wallet-section-nav';

describe('isWalletSectionNavActive', () => {
  const items = buildWalletSectionNavItems('/en/my-wallet');
  const wallet = items.find((item) => item.key === 'wallet');
  const banking = items.find((item) => item.key === 'banking');

  it('treats /transactions (including invalid token=) as the wallet section', () => {
    expect(wallet).toBeDefined();
    if (!wallet) return;
    expect(isWalletSectionNavActive(wallet, '/en/my-wallet')).toBe(true);
    expect(isWalletSectionNavActive(wallet, '/en/my-wallet/transactions')).toBe(
      true,
    );
    expect(isWalletSectionNavActive(wallet, '/en/my-wallet/assets')).toBe(true);
    expect(isWalletSectionNavActive(wallet, '/en/my-wallet/actions')).toBe(
      true,
    );
  });

  it('does not treat /banking or /rewards as the wallet section', () => {
    expect(wallet).toBeDefined();
    expect(banking).toBeDefined();
    if (!wallet || !banking) return;
    expect(isWalletSectionNavActive(wallet, '/en/my-wallet/banking')).toBe(
      false,
    );
    expect(isWalletSectionNavActive(wallet, '/en/my-wallet/rewards')).toBe(
      false,
    );
    expect(isWalletSectionNavActive(banking, '/en/my-wallet/banking')).toBe(
      true,
    );
  });
});
