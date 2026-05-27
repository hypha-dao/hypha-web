import { BridgeOnboardingForm } from './bridge-onboarding-form';
import { DEFAULT_BANK_PROVIDER, type ProviderFormRegistry } from './types';

export const providerFormRegistry: ProviderFormRegistry = {
  bridge: BridgeOnboardingForm,
};

export { DEFAULT_BANK_PROVIDER };
