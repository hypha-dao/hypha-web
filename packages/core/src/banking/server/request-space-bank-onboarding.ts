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
import { resolveBridgeKycEndorsements } from './providers/bridge/endorsements';
import { findBankCustomerBySpaceAndProvider } from './queries';

function mapCustomerToResult(
  customer: {
    kycStatus: string;
    kycLink: string | null;
    tosLink: string | null;
    name: string;
    contactEmail: string;
    endorsements: string[] | null;
  },
  created: boolean,
  meta: { spaceTitle: string; requesterSlug: string | null },
): BankOnboardingResult {
  return {
    kycStatus: customer.kycStatus,
    kycLink: customer.kycLink,
    tosLink: customer.tosLink,
    legalName: customer.name,
    contactEmail: customer.contactEmail,
    endorsements: customer.endorsements ?? [],
    provider: DEFAULT_BANK_PROVIDER,
    created,
    spaceTitle: meta.spaceTitle,
    requesterSlug: meta.requesterSlug,
  };
}

export type RequestSpaceBankOnboardingOptions = {
  kycProvider?: BankKycProvider;
};

export async function requestSpaceBankOnboarding(
  input: RequestSpaceBankOnboardingInput,
  { db }: { db: DatabaseInstance },
  options?: RequestSpaceBankOnboardingOptions,
): Promise<BankOnboardingResult> {
  const { spaceSlug, authToken, legalName, contactEmail, endorsements } = input;

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
    return mapCustomerToResult(existing, false, emailMeta);
  }

  const idempotencyKey = randomUUID();
  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const resolvedEndorsements = resolveBridgeKycEndorsements(endorsements);

  const kycLinkResult = await kycProvider.createKycLink({
    entityType: 'business',
    legalName,
    contactEmail,
    idempotencyKey,
    endorsements: resolvedEndorsements,
  });

  const customer = await insertBankCustomer(
    {
      spaceId: space.id,
      adminPersonId: auth.person.id,
      entityType: 'business',
      provider: DEFAULT_BANK_PROVIDER,
      providerCustomerId: kycLinkResult.providerCustomerId,
      providerKycLinkId: kycLinkResult.providerKycLinkId,
      name: legalName,
      contactEmail,
      endorsements: resolvedEndorsements,
      kycStatus: kycLinkResult.kycStatus,
      tosStatus: kycLinkResult.tosStatus,
      kycLink: kycLinkResult.kycLink,
      tosLink: kycLinkResult.tosLink,
      idempotencyKey,
    },
    { db },
  );

  return mapCustomerToResult(customer, true, emailMeta);
}
