import { randomUUID } from 'node:crypto';

import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { BankOnboardingError } from './errors';
import { insertBankCustomer } from './mutations';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import { resolveBridgeKycEndorsements } from './providers/bridge/endorsements';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';

export type EnsureSpaceBankCustomerInput = {
  space: Space;
  authToken: string;
  legalName?: string;
  contactEmail?: string;
  endorsements?: string[];
  redirectUri?: string;
};

export type EnsureSpaceBankCustomerResult = {
  customer: BankCustomer;
  isApproved: boolean;
  created: boolean;
  kycLink: string | null;
  tosLink: string | null;
};

export type EnsureSpaceBankCustomerOptions = {
  kycProvider?: BankKycProvider;
};

export async function ensureSpaceBankCustomer(
  input: EnsureSpaceBankCustomerInput,
  { db }: { db: DatabaseInstance },
  options?: EnsureSpaceBankCustomerOptions,
): Promise<EnsureSpaceBankCustomerResult> {
  const auth = await authorizeSpaceBankOnboarding({
    space: input.space,
    authToken: input.authToken,
  });

  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  let existing = await findBankCustomerBySpaceAndProvider(
    { spaceId: input.space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!existing) {
    const legalName = input.legalName?.trim();
    const contactEmail = input.contactEmail?.trim();
    if (!legalName || !contactEmail) {
      throw new BankOnboardingError(
        'Legal name and contact email are required to start bank verification',
        400,
      );
    }

    const kycProvider =
      options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);
    const resolvedEndorsements = resolveBridgeKycEndorsements(
      input.endorsements,
    );

    console.log('[banking] createKycLink', {
      spaceId: input.space.id,
      legalName,
      contactEmail,
      requestedEndorsements: input.endorsements,
      resolvedEndorsements,
      redirectUri: input.redirectUri,
    });

    const kycLinkResult = await kycProvider.createKycLink({
      entityType: 'business',
      legalName,
      contactEmail,
      idempotencyKey: randomUUID(),
      endorsements: resolvedEndorsements,
      redirectUri: input.redirectUri,
    });

    const customer = await insertBankCustomer(
      {
        spaceId: input.space.id,
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
        idempotencyKey: randomUUID(),
      },
      { db },
    );

    return {
      customer,
      isApproved: kycLinkResult.isApproved,
      created: true,
      kycLink: customer.kycLink,
      tosLink: customer.tosLink,
    };
  }

  let customer = existing;
  if (customer.kycStatus !== 'approved') {
    const synced = await syncBankCustomerKycFromBridge(customer, { db });
    customer = synced.customer;
  }

  const requestedEndorsements = input.endorsements
    ? resolveBridgeKycEndorsements(input.endorsements)
    : null;
  if (
    requestedEndorsements &&
    requestedEndorsements.some(
      (endorsement) => !customer.endorsements.includes(endorsement),
    )
  ) {
    console.log('[banking] existing customer missing requested endorsements', {
      spaceId: input.space.id,
      storedEndorsements: customer.endorsements,
      requestedEndorsements,
    });
  }

  return {
    customer,
    isApproved: customer.kycStatus === 'approved',
    created: false,
    kycLink: customer.kycLink,
    tosLink: customer.tosLink,
  };
}
