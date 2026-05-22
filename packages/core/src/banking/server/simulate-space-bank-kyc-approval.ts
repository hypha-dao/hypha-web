import { randomUUID } from 'node:crypto';

import { bridgeSimulateKycApproval } from '../../common/server/bridge-client';
import {
  isBankingSandboxDemoEnabled,
  isBridgeSandboxApi,
} from '../../common/server/bridge-sandbox';
import type { DatabaseInstance } from '../../common/server/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { findSpaceBySlug } from '../../space/server/queries';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { BankOnboardingError } from './errors';
import { mapBridgeApiError } from './map-bridge-api-error';
import { resolveBridgeCustomerId } from './resolve-bridge-customer-id';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { simulateBridgeKybData } from './simulate-bridge-kyb-data';

export type SimulateSpaceBankKycApprovalInput = {
  spaceSlug: string;
  authToken: string;
  /** When true (default), PUT mock KYB data on Bridge after approval simulation. */
  includeKybData?: boolean;
};

/** Intentionally minimal — UI must not react to this payload. */
export type SimulateSpaceBankKycApprovalResult = {
  ok: true;
};

/**
 * Sandbox-only: simulates KYB approval on Bridge, then optionally applies mock KYB
 * data (address). Does not update Hypha DB — refresh status to sync.
 */
export async function simulateSpaceBankKycApproval(
  input: SimulateSpaceBankKycApprovalInput,
  { db }: { db: DatabaseInstance },
): Promise<SimulateSpaceBankKycApprovalResult> {
  if (!isBankingSandboxDemoEnabled()) {
    throw new BankOnboardingError('KYB simulation is not enabled', 403);
  }

  if (!isBridgeSandboxApi()) {
    throw new BankOnboardingError(
      'KYC simulation is only available against the Bridge sandbox API',
      403,
    );
  }

  const { spaceSlug, authToken, includeKybData = true } = input;

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

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    throw new BankOnboardingError(
      'Start bank onboarding before simulating KYB approval',
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

  if (includeKybData) {
    try {
      await simulateBridgeKybData(customerId, {
        businessLegalName: customer.name,
        force: true,
      });
    } catch (error) {
      const mapped = mapBridgeApiError(error, 'PUT /customers/{id}');
      if (mapped) {
        throw mapped;
      }
      throw error;
    }
  }

  return { ok: true };
}
