import type { BankEntityType } from '../../../types';
import { BankOnboardingError } from '../../errors';
import {
  AUDD_COMPANY_TYPES,
  AUDD_COMPANY_TYPES_NEEDING_BUSINESS_NAME,
  type AuddCompanyType,
} from './onboarding-fields';

function isAuddCompanyType(value: string): value is AuddCompanyType {
  return (AUDD_COMPANY_TYPES as readonly string[]).includes(value);
}

/**
 * Resolve the AUDD `companyType` for a create-customer call.
 *
 * Hypha's shared `BankEntityType` is only `'individual' | 'business'`; AUDD needs one of five
 * `companyType` values. `individual` maps straight to `INDIVIDUAL`. `business` needs the caller to
 * have collected the specific sub-type (`SOLE_TRADER` / `PRIVATE_COMPANY` / `PUBLIC_COMPANY` /
 * `TRUST`) via the dynamic onboarding form (D10) — passed here as `formCompanyType`.
 */
export function resolveAuddCompanyType(
  entityType: BankEntityType,
  formCompanyType: string | undefined,
): AuddCompanyType {
  if (formCompanyType) {
    const normalized = formCompanyType.trim().toUpperCase();
    if (!isAuddCompanyType(normalized)) {
      throw new BankOnboardingError(
        `Unsupported AUDD companyType "${formCompanyType}"; expected one of ${AUDD_COMPANY_TYPES.join(
          ', ',
        )}.`,
        400,
      );
    }
    if (entityType === 'individual' && normalized !== 'INDIVIDUAL') {
      throw new BankOnboardingError(
        `AUDD companyType "${normalized}" conflicts with entity type "individual".`,
        400,
      );
    }
    return normalized;
  }

  if (entityType === 'individual') {
    return 'INDIVIDUAL';
  }

  throw new BankOnboardingError(
    'AUDD onboarding for a business entity requires a companyType ' +
      `(one of ${AUDD_COMPANY_TYPES.filter((t) => t !== 'INDIVIDUAL').join(
        ', ',
      )}).`,
    400,
  );
}

/** Whether this `companyType` additionally needs `companyBusinessName` on create. */
export function auddCompanyTypeNeedsBusinessName(
  companyType: AuddCompanyType,
): boolean {
  return AUDD_COMPANY_TYPES_NEEDING_BUSINESS_NAME.includes(companyType);
}

/** Whether this `companyType` additionally needs `registrationNumber` on create. */
export function auddCompanyTypeNeedsRegistrationNumber(
  companyType: AuddCompanyType,
): boolean {
  return companyType !== 'INDIVIDUAL';
}
