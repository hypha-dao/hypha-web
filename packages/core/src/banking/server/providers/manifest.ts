import type { BankProvider } from '../../types';
import { BANK_VIRTUAL_ACCOUNT_CURRENCIES } from '../../constants';
import type { BankOnboardingFieldDescriptor } from './types';
import { AUDD_REQUIRED_ONBOARDING_FIELDS } from './audd/onboarding-fields';

export { AUDD_REQUIRED_ONBOARDING_FIELDS };

/**
 * Every known bank provider, as a typed tuple to iterate over (the routing resolver walks this).
 * Keep in sync with the `BankProvider` union.
 */
export const BANK_PROVIDERS = [
  'bridge',
  'audd',
] as const satisfies readonly BankProvider[];

/**
 * Fields Bridge needs to create a customer (D10). Email + legal name only — unchanged from today.
 * Keys match the onboarding request / #2288 confirmation-token fields (`contactEmail`, `legalName`).
 */
export const BRIDGE_REQUIRED_ONBOARDING_FIELDS: readonly BankOnboardingFieldDescriptor[] =
  [
    {
      key: 'contactEmail',
      kind: 'email',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.contactEmail',
    },
    {
      key: 'legalName',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.legalName',
    },
  ];

export type BankProviderManifestEntry = {
  /**
   * Currency codes (lowercase) this provider's adapter can service — the Capability layer (D1).
   * Single source of truth; the routing resolver intersects this with the Enablement env layer.
   */
  supportedCurrencies: readonly string[];
  /** Fields the onboarding form must collect for this provider to create a customer (D10). */
  requiredOnboardingFields: readonly BankOnboardingFieldDescriptor[];
};

/**
 * The central provider registry manifest (D1 addendum) — the single source of truth for what each
 * provider can do, kept here rather than scattered on instantiated adapter objects. Adding a
 * provider only adds an entry here plus its own adapter dir; the resolver and every other entry
 * stay untouched.
 */
export const bankProviderManifest: Record<
  BankProvider,
  BankProviderManifestEntry
> = {
  bridge: {
    // Derived from the existing (Bridge-shaped) currency constant so the list lives in one place.
    supportedCurrencies: [...BANK_VIRTUAL_ACCOUNT_CURRENCIES],
    requiredOnboardingFields: BRIDGE_REQUIRED_ONBOARDING_FIELDS,
  },
  audd: {
    supportedCurrencies: ['aud'],
    requiredOnboardingFields: AUDD_REQUIRED_ONBOARDING_FIELDS,
  },
};
