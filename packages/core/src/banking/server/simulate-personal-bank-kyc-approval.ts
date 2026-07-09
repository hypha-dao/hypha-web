import { randomUUID } from 'node:crypto';

import { bridgeSimulateKycApproval } from '../../common/server/bridge-client';
import {
  isBankingSandboxDemoEnabled,
  isBridgeSandboxApi,
} from '../../common/server/bridge-sandbox';
import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findPersonBySlug } from '../../people/server/queries';
import { authorizePersonalBankOnboarding } from './authorize-personal-bank-onboarding';
import { BankOnboardingError } from './errors';
import { mapBridgeApiError } from './map-bridge-api-error';
import { resolveBridgeCustomerId } from './resolve-bridge-customer-id';
import { findBankCustomerByPersonAndProvider } from './queries';

export type SimulatePersonalBankKycApprovalInput = {
  personSlug: string;
  authToken: string;
};

/** Intentionally minimal — UI must not react to this payload. */
export type SimulatePersonalBankKycApprovalResult = {
  ok: true;
};

/**
 * Sandbox-only: simulates KYC approval on Bridge for an individual customer. Does
 * not update Hypha DB — refresh status to sync. Unlike the space (business) flow,
 * no mock KYB data is applied.
 */
export async function simulatePersonalBankKycApproval(
  input: SimulatePersonalBankKycApprovalInput,
  { db }: { db: DatabaseInstance },
): Promise<SimulatePersonalBankKycApprovalResult> {
  if (!isBankingSandboxDemoEnabled()) {
    throw new BankOnboardingError('KYC simulation is not enabled', 403);
  }

  if (!isBridgeSandboxApi()) {
    throw new BankOnboardingError(
      'KYC simulation is only available against the Bridge sandbox API',
      403,
    );
  }

  const { personSlug, authToken } = input;

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

  const customer = await findBankCustomerByPersonAndProvider(
    { personId: person.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    throw new BankOnboardingError(
      'Start bank onboarding before simulating KYC approval',
      404,
    );
  }

  let customerId: string;
  try {
    ({ customerId } = await resolveBridgeCustomerId(customer, { db }));
  } catch (error) {
    const mapped = mapBridgeApiError(error, 'fetching the KYC link');
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  try {
    await bridgeSimulateKycApproval(customerId, randomUUID());
  } catch (error) {
    const mapped = mapBridgeApiError(
      error,
      'POST /customers/{id}/simulate_kyc_approval',
    );
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  return { ok: true };
}
