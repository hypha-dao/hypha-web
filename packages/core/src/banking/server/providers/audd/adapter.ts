import { BankOnboardingError } from '../../errors';
import type {
  BankIdentityProvider,
  BankOnboardingStepDescriptor,
  CreateKycLinkInput,
  CreateKycLinkResult,
  GetKycStatusInput,
  KycStatusResult,
} from '../types';
import {
  auddCompanyTypeNeedsBusinessName,
  auddCompanyTypeNeedsRegistrationNumber,
  resolveAuddCompanyType,
} from './company-type';
import {
  auddCreateCustomer,
  auddExchangeToken,
  auddListCustomers,
  auddSubmitKyc,
  toAuddIdempotencyKey,
  type AuddClientConfig,
  type AuddCreateCustomerBody,
} from './audd-client';
import { mapAuddApiError } from './map-audd-api-error';
import { AUDD_REQUIRED_ONBOARDING_FIELDS } from './onboarding-fields';

/**
 * KYC-status values probed against `GET /customer/customers?kycStatus=` to locate a customer's
 * bucket (there is no clean status read — `audd-gateway-api-reference.md`). Order by likelihood
 * of a settled outcome first. Portal vocabulary + the one value the docs name (`REVERIFICATION_REQUIRED`).
 */
export const AUDD_KYC_STATUS_PROBE_ORDER = [
  'APPROVED',
  'PENDING',
  'FAILED',
  'INCOMPLETE',
  'REVERIFICATION_REQUIRED',
] as const;

const AUDD_ONBOARDING_STEP_I18N_KEYS: BankOnboardingStepDescriptor['i18nKeys'] =
  {
    title: 'BankingTab.onboardingSteps.kyc.title',
    body: 'BankingTab.onboardingSteps.kyc.body',
  };

function requireField(
  fields: Record<string, string>,
  key: string,
  missing: string[],
): string {
  const value = fields[key]?.trim();
  if (!value) {
    missing.push(key);
    return '';
  }
  return value;
}

function buildCreateCustomerBody(
  input: CreateKycLinkInput,
): AuddCreateCustomerBody {
  const fields = input.onboardingFields ?? {};
  const missing: string[] = [];

  const companyType = resolveAuddCompanyType(
    input.entityType,
    fields.companyType,
  );

  const body: AuddCreateCustomerBody = {
    firstName: requireField(fields, 'firstName', missing),
    lastName: requireField(fields, 'lastName', missing),
    email: (input.contactEmail || fields.contactEmail || '').trim(),
    phoneNumber: requireField(fields, 'phoneNumber', missing),
    dateOfBirth: requireField(fields, 'dateOfBirth', missing),
    addressLine1: requireField(fields, 'addressLine1', missing),
    suburb: requireField(fields, 'suburb', missing),
    postcode: requireField(fields, 'postcode', missing),
    state: requireField(fields, 'state', missing),
    country: requireField(fields, 'country', missing),
    companyType,
  };

  if (!body.email) {
    missing.push('contactEmail');
  }

  if (fields.middleName?.trim()) {
    body.middleName = fields.middleName.trim();
  }
  if (fields.addressLine2?.trim()) {
    body.addressLine2 = fields.addressLine2.trim();
  }

  const merchantGroupId = process.env.AUDD_GATEWAY_MERCHANT_GROUP_ID?.trim();
  if (merchantGroupId) {
    body.merchantGroupId = merchantGroupId;
  }

  if (auddCompanyTypeNeedsRegistrationNumber(companyType)) {
    body.registrationNumber = requireField(
      fields,
      'registrationNumber',
      missing,
    );
  }
  if (auddCompanyTypeNeedsBusinessName(companyType)) {
    body.companyBusinessName = requireField(
      fields,
      'companyBusinessName',
      missing,
    );
  }

  if (missing.length > 0) {
    throw new BankOnboardingError(
      `AUDD onboarding is missing required field(s): ${missing.join(', ')}.`,
      400,
    );
  }

  return body;
}

function resolveTierId(): string {
  const tierId = process.env.AUDD_GATEWAY_TIER_ID?.trim();
  if (!tierId) {
    throw new BankOnboardingError(
      'AUDD_GATEWAY_TIER_ID is not configured; cannot submit KYC.',
      500,
    );
  }
  return tierId;
}

/**
 * AUDD Gateway identity/KYC adapter (D6 — identity-only; not registered as a `BankKycProvider`).
 * `createKycLink` runs AUDD's onboarding as one call: create customer → submit KYC → return the
 * hosted `verificationUrl`. Built directly against the real sandbox (D13); no mock layer.
 */
export function createAuddIdentityProvider(
  config?: AuddClientConfig,
): BankIdentityProvider {
  return {
    provider: 'audd',
    requiredOnboardingFields: AUDD_REQUIRED_ONBOARDING_FIELDS,

    async createKycLink(
      input: CreateKycLinkInput,
    ): Promise<CreateKycLinkResult> {
      const body = buildCreateCustomerBody(input);
      const tierId = resolveTierId();

      try {
        const token = await auddExchangeToken(config);
        const customer = await auddCreateCustomer(
          body,
          {
            accessToken: token.accessToken,
            idempotencyKey: toAuddIdempotencyKey(input.idempotencyKey),
          },
          config,
        );
        const kyc = await auddSubmitKyc(
          customer.id,
          { tierId },
          {
            accessToken: token.accessToken,
            idempotencyKey: toAuddIdempotencyKey(`${input.idempotencyKey}:kyc`),
          },
          config,
        );

        return {
          providerCustomerId: customer.id,
          providerKycLinkId: kyc.customerId || customer.id,
          kycStatus: kyc.kycStatus || 'PENDING',
          isApproved: false,
          tosStatus: null,
          kycLink: kyc.verificationUrl,
          tosLink: null,
        };
      } catch (error) {
        throw mapAuddApiError(error, 'create AUDD KYC link') ?? error;
      }
    },

    async getKycStatus(
      input: GetKycStatusInput,
    ): Promise<KycStatusResult | null> {
      const customerId = input.customer.providerCustomerId;
      if (!customerId) {
        // No provider-side customer yet (e.g. a #2288 pending-confirmation row).
        return null;
      }

      try {
        const token = await auddExchangeToken(config);

        for (const kycStatus of AUDD_KYC_STATUS_PROBE_ORDER) {
          const page = await auddListCustomers(
            { accessToken: token.accessToken, kycStatus, limit: 100 },
            config,
          );
          if (page.items.some((item) => item.id === customerId)) {
            return {
              kycStatus,
              isApproved: kycStatus === 'APPROVED',
              tosStatus: null,
              kycLink: null,
            };
          }
        }

        // Customer exists but isn't in any probed bucket — treat as still pending.
        return {
          kycStatus: 'PENDING',
          isApproved: false,
          tosStatus: null,
          kycLink: null,
        };
      } catch (error) {
        throw mapAuddApiError(error, 'read AUDD KYC status') ?? error;
      }
    },

    getOnboardingStepDescriptor(
      result: Pick<CreateKycLinkResult, 'kycLink'>,
    ): BankOnboardingStepDescriptor {
      return {
        kind: 'external_kyc_link',
        url: result.kycLink ?? null,
        i18nKeys: AUDD_ONBOARDING_STEP_I18N_KEYS,
      };
    },
  };
}
