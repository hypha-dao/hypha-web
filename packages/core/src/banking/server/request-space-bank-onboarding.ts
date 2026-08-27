import type { DatabaseInstance } from '../../common/server/types';
import {
  DEFAULT_BANK_PROVIDER,
  PENDING_EMAIL_CONFIRMATION_VALIDATION,
} from '../constants';
import { findSpaceBySlug } from '../../space/server/queries';
import { findPersonById } from '../../people/server/queries';
import type {
  BankOnboardingResult,
  RequestSpaceBankOnboardingInput,
} from '../types';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { BankOnboardingError } from './errors';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import {
  requestBankOnboardingWithConfirmation,
  type BankOnboardingOwnerRef,
} from './bank-onboarding-confirmation';

export type RequestSpaceBankOnboardingOptions = {
  kycProvider?: BankKycProvider;
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

export async function requestSpaceBankOnboarding(
  input: RequestSpaceBankOnboardingInput,
  { db }: { db: DatabaseInstance },
  options: RequestSpaceBankOnboardingOptions,
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

  const submitter = await findPersonById({ id: auth.person.id }, { db });

  const ownerRef: BankOnboardingOwnerRef = {
    type: 'space',
    id: space.id,
    slug: space.slug,
    label: space.title,
  };

  const result = await requestBankOnboardingWithConfirmation(
    {
      ownerRef,
      entityType: 'business',
      legalName,
      contactEmail,
      requestedRails,
      redirectUri,
      submitterPersonId: auth.person.id,
      submitterEmail: submitter?.email ?? null,
      sendConfirmationEmail: options.sendConfirmationEmail,
    },
    { db },
    { kycProvider: options.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER) },
  );

  if (result.kind === 'pendingConfirmation') {
    return {
      provider: DEFAULT_BANK_PROVIDER,
      created: false,
      pendingEmailConfirmation: true,
      spaceTitle: space.title,
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
    provider: DEFAULT_BANK_PROVIDER,
    created: result.kind === 'created',
    spaceTitle: space.title,
    requesterSlug: auth.person.slug ?? null,
    kycLink: result.kycLink,
    tosLink: result.tosLink,
    procedures: result.procedures,
  };
}
