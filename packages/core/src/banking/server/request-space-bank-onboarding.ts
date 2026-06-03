import type { DatabaseInstance } from '../../common/server/types';
import { findPersonById } from '../../people/server/queries';
import { findSpaceBySlug } from '../../space/server/queries';
import type {
  BankOnboardingResult,
  PendingEmailConfirmationResult,
  RequestSpaceBankOnboardingInput,
} from '../types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { BankOnboardingError } from './errors';
import { buildPublicStatusFromCustomer } from './get-space-bank-customer-public-status';
import { initiateEmailConfirmation } from './initiate-email-confirmation';
import { emailsMatchForBypass } from '../normalize-email-for-bypass';
import { insertBankCustomer } from './mutations';
import {
  buildBankOnboardingResultFromKycLink,
  performKycLinkAndInsert,
} from './perform-kyc-link-and-insert';
import { findBankCustomerBySpaceAndProvider } from './queries';
import type { BankKycProvider } from './providers/types';
import { getBankKycProvider } from './providers';
import type { InitiateEmailConfirmationResult } from './initiate-email-confirmation';

export type RequestSpaceBankOnboardingOptions = {
  kycProvider?: BankKycProvider;
};

export type RequestSpaceBankOnboardingOutput =
  | {
      status: 'existing' | 'created';
      result: BankOnboardingResult;
      kybEmail?: {
        recipientEmail: string;
        legalName: string;
      };
    }
  | {
      status: 'pending_email_confirmation';
      result: PendingEmailConfirmationResult;
      initiate: InitiateEmailConfirmationResult;
    };

export async function requestSpaceBankOnboarding(
  input: RequestSpaceBankOnboardingInput,
  { db }: { db: DatabaseInstance },
  options?: RequestSpaceBankOnboardingOptions,
): Promise<RequestSpaceBankOnboardingOutput> {
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

  const normalizedRails = requestedRails?.map((rail) => rail.toLowerCase()) ?? [];

  if (existing?.providerKycLinkId) {
    const status = await buildPublicStatusFromCustomer(existing, { db });
    return {
      status: 'existing',
      result: {
        provider: DEFAULT_BANK_PROVIDER,
        created: false,
        spaceTitle: emailMeta.spaceTitle,
        requesterSlug: emailMeta.requesterSlug,
        kycLink: status.procedures.kyc.action?.url ?? null,
        tosLink: status.procedures.tos.action?.url ?? null,
        procedures: status.procedures,
      },
    };
  }

  const initiate = async () =>
    initiateEmailConfirmation(
      {
        space,
        person: auth.person,
        legalName,
        providerCustomerEmail: contactEmail,
        requestedRails: normalizedRails,
        redirectUri,
      },
      { db },
    );

  if (existing?.jwtNonce && !existing.providerKycLinkId) {
    const initiateResult = await initiate();
    return {
      status: 'pending_email_confirmation',
      result: { status: 'pending_email_confirmation' },
      initiate: initiateResult,
    };
  }

  const submitter = await findPersonById({ id: auth.person.id }, { db });
  const submitterEmail = submitter?.email?.trim();

  if (
    submitterEmail &&
    emailsMatchForBypass(submitterEmail, contactEmail)
  ) {
    const performResult = await performKycLinkAndInsert(
      {
        legalName,
        contactEmail,
        requestedRails: normalizedRails,
        redirectUri,
      },
      { db },
      options,
    );

    await insertBankCustomer(
      {
        spaceId: space.id,
        entityType: 'business',
        provider: DEFAULT_BANK_PROVIDER,
        providerCustomerId: performResult.kycLinkResult.providerCustomerId,
        providerKycLinkId: performResult.kycLinkResult.providerKycLinkId,
        requestedRails: normalizedRails,
      },
      { db },
    );

    return {
      status: 'created',
      result: buildBankOnboardingResultFromKycLink({
        kycLinkResult: performResult.kycLinkResult,
        created: performResult.created,
        spaceTitle: emailMeta.spaceTitle,
        requesterSlug: emailMeta.requesterSlug,
      }),
      kybEmail: {
        recipientEmail: contactEmail,
        legalName,
      },
    };
  }

  const initiateResult = await initiate();
  return {
    status: 'pending_email_confirmation',
    result: { status: 'pending_email_confirmation' },
    initiate: initiateResult,
  };
}
