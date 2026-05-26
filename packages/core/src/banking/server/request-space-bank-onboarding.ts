import { randomUUID } from 'node:crypto';

import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findSpaceBySlug } from '../../space/server/queries';
import type {
  BankOnboardingResult,
  RequestSpaceBankOnboardingInput,
} from '../types';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { BankOnboardingError } from './errors';
import { insertBankCustomer } from './mutations';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import { currenciesToEndorsements } from '../constants';
import { buildPublicStatusFromCustomer } from './get-space-bank-customer-public-status';
import { buildCustomerValidations } from './providers/bridge/banking-provider-state';
import { findBankCustomerBySpaceAndProvider } from './queries';

export type RequestSpaceBankOnboardingOptions = {
  kycProvider?: BankKycProvider;
};

export async function requestSpaceBankOnboarding(
  input: RequestSpaceBankOnboardingInput,
  { db }: { db: DatabaseInstance },
  options?: RequestSpaceBankOnboardingOptions,
): Promise<BankOnboardingResult> {
  const {
    spaceSlug,
    authToken,
    legalName,
    contactEmail,
    requestedRails,
    redirectUri,
  } = input;

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const auth = await authorizeSpaceBankOnboarding({
    space,
    authToken,
  });

  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const emailMeta = {
    spaceTitle: space.title,
    requesterSlug: auth.person.slug ?? null,
  };

  const existing = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (existing) {
    const status = await buildPublicStatusFromCustomer(existing, { db });
    return {
      provider: DEFAULT_BANK_PROVIDER,
      created: false,
      spaceTitle: emailMeta.spaceTitle,
      requesterSlug: emailMeta.requesterSlug,
      kycLink: status.procedures.kyc.action?.url ?? null,
      tosLink: status.procedures.tos.action?.url ?? null,
      procedures: status.procedures,
    };
  }

  const normalizedRails =
    requestedRails?.map((r) => r.toLowerCase()) ??
    [];
  const endorsements = currenciesToEndorsements(normalizedRails);

  const idempotencyKey = randomUUID();
  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const kycLinkResult = await kycProvider.createKycLink({
    entityType: 'business',
    legalName,
    contactEmail,
    idempotencyKey,
    endorsements,
    redirectUri,
  });

  await insertBankCustomer(
    {
      spaceId: space.id,
      entityType: 'business',
      provider: DEFAULT_BANK_PROVIDER,
      providerCustomerId: kycLinkResult.providerCustomerId,
      providerKycLinkId: kycLinkResult.providerKycLinkId,
      requestedRails: normalizedRails,
    },
    { db },
  );

  const validations = buildCustomerValidations({
    id: kycLinkResult.providerKycLinkId,
    kyc_link: kycLinkResult.kycLink,
    kyc_status: kycLinkResult.kycStatus,
    tos_status: kycLinkResult.tosStatus,
    tos_link: kycLinkResult.tosLink,
    customer_id: kycLinkResult.providerCustomerId,
  });

  return {
    provider: DEFAULT_BANK_PROVIDER,
    created: true,
    spaceTitle: emailMeta.spaceTitle,
    requesterSlug: emailMeta.requesterSlug,
    kycLink: validations.kycLink,
    tosLink: validations.tosLink,
    procedures: {
      tos: validations.tos,
      kyc: validations.kyc,
    },
  };
}
