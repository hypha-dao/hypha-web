import type { DatabaseInstance } from '../../common/server/types';
import { PENDING_EMAIL_CONFIRMATION_VALIDATION } from '../constants';
import { findPersonBySlug, findPersonById } from '../../people/server/queries';
import type {
  PersonalBankOnboardingResult,
  RequestPersonalBankOnboardingInput,
} from '../types';
import { authorizePersonalBankOnboarding } from './authorize-personal-bank-onboarding';
import { BankOnboardingError } from './errors';
import {
  getBankIdentityProvider,
  resolveProviderForOnboarding,
} from './providers';
import type { BankIdentityProvider } from './providers/types';
import {
  requestBankOnboardingWithConfirmation,
  type BankOnboardingOwnerRef,
} from './bank-onboarding-confirmation';

export type RequestPersonalBankOnboardingOptions = {
  kycProvider?: BankIdentityProvider;
  /**
   * Sends the #2288 ownership-confirmation email. Never receives anything but the token to embed
   * in the link — the token itself must never appear in this function's return value (D6).
   */
  sendConfirmationEmail: (input: {
    token: string;
    ownerLabel: string;
    contactEmail: string;
  }) => Promise<void>;
};

export async function requestPersonalBankOnboarding(
  input: RequestPersonalBankOnboardingInput,
  { db }: { db: DatabaseInstance },
  options: RequestPersonalBankOnboardingOptions,
): Promise<PersonalBankOnboardingResult> {
  const {
    personSlug,
    authToken,
    legalName,
    contactEmail,
    requestedRails,
    redirectUri,
    onboardingFields,
  } = input;

  const kycProvider =
    options.kycProvider ??
    getBankIdentityProvider(resolveProviderForOnboarding(requestedRails));

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

  const submitter = await findPersonById({ id: auth.person.id }, { db });

  const ownerRef: BankOnboardingOwnerRef = {
    type: 'person',
    id: person.id,
    slug: person.slug ?? personSlug,
    label: legalName,
  };

  const result = await requestBankOnboardingWithConfirmation(
    {
      ownerRef,
      entityType: 'individual',
      legalName,
      contactEmail,
      requestedRails,
      redirectUri,
      onboardingFields,
      submitterPersonId: auth.person.id,
      submitterEmail: submitter?.email ?? null,
      sendConfirmationEmail: options.sendConfirmationEmail,
    },
    { db },
    { kycProvider },
  );

  if (result.kind === 'pendingConfirmation') {
    return {
      provider: kycProvider.provider,
      created: false,
      pendingEmailConfirmation: true,
      ownerName: legalName,
      requesterSlug: auth.person.slug ?? null,
      kycLink: null,
      tosLink: null,
      procedures: {
        tos: PENDING_EMAIL_CONFIRMATION_VALIDATION,
        kyc: PENDING_EMAIL_CONFIRMATION_VALIDATION,
      },
    };
  }

  return {
    provider: kycProvider.provider,
    created: result.kind === 'created',
    ownerName: legalName,
    requesterSlug: auth.person.slug ?? null,
    kycLink: result.kycLink,
    tosLink: result.tosLink,
    procedures: result.procedures,
  };
}
