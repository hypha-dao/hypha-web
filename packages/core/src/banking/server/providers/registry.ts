import type { BankProvider } from '../../types';
import type { BankKycProvider } from './types';
import { createBridgeKycProvider } from './bridge/adapter';

const providerFactories: Record<BankProvider, () => BankKycProvider> = {
  bridge: createBridgeKycProvider,
};

export function getBankKycProvider(provider: BankProvider): BankKycProvider {
  const factory = providerFactories[provider];
  if (!factory) {
    throw new Error(`Unsupported bank KYC provider: ${provider}`);
  }
  return factory();
}
