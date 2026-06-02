import { randomUUID } from 'node:crypto';

import type { DatabaseInstance } from '../../common/server/types';
import { bridgeGetCustomersByEmail, bridgeGetKycLink } from '../../common/server/bridge-client';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { BankEntityType, BankOnboardingResult } from '../types';
import { currenciesToEndorsements } from '../constants';
import { BankOnboardingError } from './errors';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import { buildCustomerValidations } from './providers/bridge/banking-provider-state';
import {
  findBankCustomerByProviderCustomerId,
} from './queries';
import type { CreateKycLinkResult } from './providers/types';

export type PerformKycLinkAndInsertInput = {
  legalName: string;
  contactEmail: string;
  requestedRails: string[];
  redirectUri?: string | null;
  entityType?: BankEntityType;
};

export type PerformKycLinkAndInsertResult = {
  created: boolean;
  kycLinkResult: CreateKycLinkResult;
};

export type PerformKycLinkAndInsertOptions = {
  kycProvider?: BankKycProvider;
};

/**
 * Bridge call only — no DB write. Caller is responsible for inserting or updating
 * the bank_customers row.
 *
 * Authorization must already be verified by the caller (bypass POST auth or valid
 * confirmation JWT + nonce lookup).
 */
export async function performKycLinkAndInsert(
  input: PerformKycLinkAndInsertInput,
  { db }: { db: DatabaseInstance },
  options?: PerformKycLinkAndInsertOptions,
): Promise<PerformKycLinkAndInsertResult> {
  const {
    legalName,
    contactEmail,
    requestedRails,
    redirectUri,
    entityType = 'business',
  } = input;

  const normalizedRails = requestedRails.map((rail) => rail.toLowerCase());
  const endorsements = currenciesToEndorsements(normalizedRails);

  const bridgeLookup = await bridgeGetCustomersByEmail(contactEmail);
  if (bridgeLookup.count > 0 && bridgeLookup.data[0]) {
    const bridgeCustomerId = bridgeLookup.data[0].id;
    const linked = await findBankCustomerByProviderCustomerId(
      { providerCustomerId: bridgeCustomerId, provider: DEFAULT_BANK_PROVIDER },
      { db },
    );

    if (!linked?.providerKycLinkId) {
      throw new BankOnboardingError(
        'This email is already associated with a Bridge customer — use the existing customer linking flow',
        409,
      );
    }

    const kycLink = await bridgeGetKycLink(linked.providerKycLinkId);

    return {
      created: false,
      kycLinkResult: {
        providerCustomerId: kycLink.customer_id ?? bridgeCustomerId,
        providerKycLinkId: kycLink.id,
        kycStatus: kycLink.kyc_status,
        isApproved: kycLink.kyc_status === 'approved',
        tosStatus: kycLink.tos_status ?? null,
        kycLink: kycLink.kyc_link,
        tosLink: kycLink.tos_link ?? null,
      },
    };
  }

  const idempotencyKey = randomUUID();
  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const kycLinkResult = await kycProvider.createKycLink({
    entityType,
    legalName,
    contactEmail,
    idempotencyKey,
    endorsements,
    redirectUri: redirectUri ?? undefined,
  });

  return {
    created: true,
    kycLinkResult,
  };
}

export function buildBankOnboardingResultFromKycLink(input: {
  kycLinkResult: CreateKycLinkResult;
  created: boolean;
  spaceTitle: string;
  requesterSlug: string | null;
}): BankOnboardingResult {
  const validations = buildCustomerValidations({
    id: input.kycLinkResult.providerKycLinkId,
    kyc_link: input.kycLinkResult.kycLink,
    kyc_status: input.kycLinkResult.kycStatus,
    tos_status: input.kycLinkResult.tosStatus,
    tos_link: input.kycLinkResult.tosLink,
    customer_id: input.kycLinkResult.providerCustomerId,
  });

  return {
    provider: DEFAULT_BANK_PROVIDER,
    created: input.created,
    spaceTitle: input.spaceTitle,
    requesterSlug: input.requesterSlug,
    kycLink: validations.kycLink,
    tosLink: validations.tosLink,
    procedures: {
      tos: validations.tos,
      kyc: validations.kyc,
    },
  };
}
