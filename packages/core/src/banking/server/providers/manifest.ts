import type { BankProvider } from '../../types';
import { BANK_VIRTUAL_ACCOUNT_CURRENCIES } from '../../constants';
import type { BankOnboardingFieldDescriptor } from './types';

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

/**
 * Fields AUDD's Gateway needs to create a customer (D10). Email + legal name are shared with
 * Bridge (the onboarding form dedupes by key); `companyType` is AUDD-specific.
 *
 * TODO(#2474 WS3): relocate to `providers/audd/onboarding-fields.ts` once the adapter dir exists,
 * and confirm the full list (company sub-types likely also need country + registration details)
 * against AUDD's live Sandbox docs.
 */
export const AUDD_REQUIRED_ONBOARDING_FIELDS: readonly BankOnboardingFieldDescriptor[] =
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
    {
      key: 'companyType',
      kind: 'select',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.companyType',
      options: [
        {
          value: 'INDIVIDUAL',
          i18nLabelKey: 'BankingTab.onboardingFields.companyType.individual',
        },
        {
          value: 'SOLE_TRADER',
          i18nLabelKey: 'BankingTab.onboardingFields.companyType.soleTrader',
        },
        {
          value: 'PRIVATE_COMPANY',
          i18nLabelKey: 'BankingTab.onboardingFields.companyType.privateCompany',
        },
        {
          value: 'PUBLIC_COMPANY',
          i18nLabelKey: 'BankingTab.onboardingFields.companyType.publicCompany',
        },
        {
          value: 'TRUST',
          i18nLabelKey: 'BankingTab.onboardingFields.companyType.trust',
        },
      ],
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
