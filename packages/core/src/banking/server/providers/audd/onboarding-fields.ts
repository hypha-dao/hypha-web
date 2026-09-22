import type { BankOnboardingFieldDescriptor } from '../types';

/**
 * The `companyType` enum AUDD's Gateway accepts on `POST /customer/customers`
 * (`audd-gateway-api-reference.md`; sandbox portal Add-customer form confirmed
 * `SOLE_TRADER / PRIVATE_COMPANY / PUBLIC_COMPANY / TRUST`, docs add `INDIVIDUAL`).
 */
export const AUDD_COMPANY_TYPES = [
  'INDIVIDUAL',
  'SOLE_TRADER',
  'PRIVATE_COMPANY',
  'PUBLIC_COMPANY',
  'TRUST',
] as const;

export type AuddCompanyType = (typeof AUDD_COMPANY_TYPES)[number];

/** `companyType` values that additionally require `companyBusinessName` (docs `MODEL7678d9`). */
export const AUDD_COMPANY_TYPES_NEEDING_BUSINESS_NAME: readonly AuddCompanyType[] =
  ['PRIVATE_COMPANY', 'PUBLIC_COMPANY', 'TRUST'];

/**
 * Fields AUDD's Gateway needs to create a customer (D10). Distilled from AUDD's devhub
 * `POST /customer/customers` reference + the sandbox portal Add-customer form (2026-09-07).
 *
 * `contactEmail` is the one key shared with Bridge (the onboarding form dedupes by key). AUDD
 * splits the applicant name into `firstName` / `lastName` rather than Bridge's single `legalName`,
 * and needs contact + address + `companyType` on top — hence the fuller set here (WS3 as-built;
 * the plan's placeholder assumed email + legalName + companyType only).
 *
 * `registrationNumber` (required for every `companyType` except `INDIVIDUAL`) and
 * `companyBusinessName` (required for `PRIVATE_COMPANY` / `PUBLIC_COMPANY` / `TRUST`) are
 * conditionally required — declared here as optional and enforced in the adapter once
 * `companyType` is known.
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
      key: 'firstName',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.firstName',
    },
    {
      key: 'lastName',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.lastName',
    },
    {
      key: 'middleName',
      kind: 'text',
      required: false,
      i18nLabelKey: 'BankingTab.onboardingFields.middleName',
    },
    {
      key: 'phoneNumber',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.phoneNumber',
    },
    {
      key: 'dateOfBirth',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.dateOfBirth',
    },
    {
      key: 'addressLine1',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.addressLine1',
    },
    {
      key: 'addressLine2',
      kind: 'text',
      required: false,
      i18nLabelKey: 'BankingTab.onboardingFields.addressLine2',
    },
    {
      key: 'suburb',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.suburb',
    },
    {
      key: 'postcode',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.postcode',
    },
    {
      key: 'state',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.state',
    },
    {
      key: 'country',
      kind: 'text',
      required: true,
      i18nLabelKey: 'BankingTab.onboardingFields.country',
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
    {
      key: 'registrationNumber',
      kind: 'text',
      required: false,
      i18nLabelKey: 'BankingTab.onboardingFields.registrationNumber',
    },
    {
      key: 'companyBusinessName',
      kind: 'text',
      required: false,
      i18nLabelKey: 'BankingTab.onboardingFields.companyBusinessName',
    },
  ];
