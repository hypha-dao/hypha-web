import { randomUUID } from 'node:crypto';

import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findPersonBySlug } from '../../people/server/queries';
import type {
  PersonalBankOnboardingResult,
  RequestPersonalBankOnboardingInput,
} from '../types';
import { authorizePersonalBankOnboarding } from './authorize-personal-bank-onboarding';
import { BankOnboardingError } from './errors';
import { insertBankCustomer } from './mutations';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import { currenciesToEndorsements } from '../constants';
import {
  buildCustomerValidations,
  loadBankingProviderState,
} from './providers/bridge/banking-provider-state';
import { findBankCustomerByPersonAndProvider } from './queries';

export type RequestPersonalBankOnboardingOptions = {
  kycProvider?: BankKycProvider;
};

export async function requestPersonalBankOnboarding(
  input: RequestPersonalBankOnboardingInput,
  { db }: { db: DatabaseInstance },
  options?: RequestPersonalBankOnboardingOptions,
): Promise<PersonalBankOnboardingResult> {
  const {
    personSlug,
    authToken,
    legalName,
    contactEmail,
    requestedRails,
    redirectUri,
  } = input;

  const person = await findPersonBySlug({ slug: personSlug }, { db });
  if (!person) {
    throw new BankOnboardingError('Person not found', 404);
  }

  const auth = await authorizePersonalBankOnboarding({
    person: { id: person.id },
    authToken,
  });

  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const requesterSlug = auth.person.slug ?? null;

  const existing = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (existing) {
    const state = await loadBankingProviderState(existing);
    const validations = buildCustomerValidations(state.kycLink);

    return {
      provider: DEFAULT_BANK_PROVIDER,
      created: false,
      ownerName: legalName,
      requesterSlug,
      kycLink: validations.kycLink,
      tosLink: validations.tosLink,
      procedures: {
        tos: validations.tos,
        kyc: validations.kyc,
      },
    };
  }

  const normalizedRails = requestedRails?.map((r) => r.toLowerCase()) ?? [];
  const endorsements = currenciesToEndorsements(normalizedRails);

  const idempotencyKey = randomUUID();
  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const kycLinkResult = await kycProvider.createKycLink({
    entityType: 'individual',
    legalName,
    contactEmail,
    idempotencyKey,
    endorsements,
    redirectUri,
  });

  await insertBankCustomer(
    {
      personId: person.id,
      entityType: 'individual',
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
    ownerName: legalName,
    requesterSlug,
    kycLink: validations.kycLink,
    tosLink: validations.tosLink,
    procedures: {
      tos: validations.tos,
      kyc: validations.kyc,
    },
  };
}
