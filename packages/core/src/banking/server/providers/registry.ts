import type { BankProvider } from '../../types';
import type { BankIdentityProvider, BankKycProvider } from './types';
import { createBridgeKycProvider } from './bridge/adapter';

const kycProviderFactories: Partial<
  Record<BankProvider, () => BankKycProvider>
> = {
  bridge: createBridgeKycProvider,
};

/**
 * Identity/KYC-only factories (D6). Every `BankKycProvider` is also a `BankIdentityProvider`, so
 * Bridge is reused here. AUDD (identity-only) registers here but deliberately NOT in
 * `kycProviderFactories`, so `getBankKycProvider('audd')` throws.
 */
const identityProviderFactories: Partial<
  Record<BankProvider, () => BankIdentityProvider>
> = {
  bridge: createBridgeKycProvider,
};

export function getBankKycProvider(provider: BankProvider): BankKycProvider {
  const factory = kycProviderFactories[provider];
  if (!factory) {
    throw new Error(`Unsupported bank KYC provider: ${provider}`);
  }
  return factory();
}

export function getBankIdentityProvider(
  provider: BankProvider,
): BankIdentityProvider {
  const factory = identityProviderFactories[provider];
  if (!factory) {
    throw new Error(`Unsupported bank identity provider: ${provider}`);
  }
  return factory();
}
