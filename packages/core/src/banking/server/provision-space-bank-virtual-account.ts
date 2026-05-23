import { randomUUID } from 'node:crypto';

import { isBridgeSandboxApi } from '../../common/server/bridge-sandbox';
import type { DatabaseInstance } from '../../common/server/types';
import { simulateBridgeKybData } from './simulate-bridge-kyb-data';
import { DEFAULT_BANK_PROVIDER, getPaymentRailForCurrency } from '../constants';
import type {
  ProvisionSpaceBankVirtualAccountResult,
  RequestSpaceBankVirtualAccountInput,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { BankOnboardingError, BANK_SETUP_FAILED_USER_MESSAGE } from './errors';
import { mapBridgeApiError } from './map-bridge-api-error';
import {
  insertBankVirtualAccount,
  updateBankVirtualAccount,
} from './mutations';
import { enrichBridgeDepositInstructions } from './enrich-bridge-deposit-instructions';
import { mapBankVirtualAccountToPublic } from './map-bank-virtual-account-public';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import {
  findBankCustomerBySpaceAndProvider,
  findBankVirtualAccountByCorridorAndCustomer,
} from './queries';
import {
  fetchBridgeCustomerEndorsementStatuses,
  getEndorsementForCurrency,
  isBridgeEndorsementApproved,
  resolveEndorsementStatusFromMap,
} from './bridge-customer-endorsements';
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';
import { persistVirtualAccountEndorsementFromBridge } from './sync-bank-virtual-account-endorsement';

function mapBridgeProvisionError(error: unknown): BankOnboardingError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const status = (error as Error & { status?: number }).status;
  if (status !== undefined && status >= 400 && status < 500) {
    console.error('Bridge virtual account provisioning failed:', error);
    return new BankOnboardingError(BANK_SETUP_FAILED_USER_MESSAGE, 400);
  }

  return null;
}

export type ProvisionSpaceBankVirtualAccountOptions = {
  kycProvider?: BankKycProvider;
};

export async function provisionSpaceBankVirtualAccount(
  input: RequestSpaceBankVirtualAccountInput,
  { db }: { db: DatabaseInstance },
  options?: ProvisionSpaceBankVirtualAccountOptions,
): Promise<ProvisionSpaceBankVirtualAccountResult> {
  const { spaceSlug, authToken, currency } = input;

  const paymentRail = getPaymentRailForCurrency(currency);
  if (!paymentRail) {
    throw new BankOnboardingError('Unsupported currency', 400);
  }

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
      'Complete business verification before setting up deposit accounts',
      404,
    );
  }

  const existing = await findBankVirtualAccountByCorridorAndCustomer(
    {
      bankCustomerId: customer.id,
      currency,
      paymentRail,
    },
    { db },
  );

  if (existing?.providerVirtualAccountId) {
    return {
      ...mapBankVirtualAccountToPublic(existing),
      created: false,
    };
  }

  let resolvedCustomer = customer;
  let resolvedAccount = existing;

  if (resolvedAccount && !resolvedAccount.providerVirtualAccountId) {
    const persisted = await persistVirtualAccountEndorsementFromBridge(
      resolvedAccount,
      resolvedCustomer,
      { db },
    );
    resolvedAccount = persisted.account;
    if (!persisted.isApproved) {
      throw new BankOnboardingError(
        'This currency is not yet approved in Bridge. Complete verification for this corridor first.',
        403,
      );
    }
  } else if (!resolvedAccount) {
    let customerId = resolvedCustomer.providerCustomerId;
    if (!customerId) {
      const syncedCustomer = await syncBankCustomerKycFromBridge(
        resolvedCustomer,
        { db },
      );
      resolvedCustomer = syncedCustomer.customer;
      customerId = resolvedCustomer.providerCustomerId ?? null;
    }

    if (!customerId) {
      throw new BankOnboardingError(
        'Bridge customer is not ready yet. Try again after KYB approval completes.',
        422,
      );
    }

    const endorsement = getEndorsementForCurrency(currency);
    if (!endorsement) {
      throw new BankOnboardingError('Unsupported currency', 400);
    }

    const statusMap = await fetchBridgeCustomerEndorsementStatuses(customerId);
    const endorsementStatus = resolveEndorsementStatusFromMap(
      statusMap,
      endorsement,
    );
    if (!isBridgeEndorsementApproved(endorsementStatus)) {
      throw new BankOnboardingError(
        'This currency is not yet approved in Bridge. Complete verification for this corridor first.',
        403,
      );
    }
  }

  let customerId = resolvedCustomer.providerCustomerId;

  if (!customerId) {
    const synced = await syncBankCustomerKycFromBridge(resolvedCustomer, {
      db,
    });
    resolvedCustomer = synced.customer;
    customerId = resolvedCustomer.providerCustomerId ?? null;
  }

  if (!customerId) {
    throw new BankOnboardingError(
      'Bridge customer is not ready yet. Try again after KYB approval completes.',
      422,
    );
  }

  if (!space.address) {
    throw new BankOnboardingError(
      'Space treasury address is required before provisioning deposit accounts',
      422,
    );
  }

  if (isBridgeSandboxApi()) {
    try {
      await simulateBridgeKybData(customerId, {
        businessLegalName: resolvedCustomer.name,
      });
    } catch (error) {
      const mapped = mapBridgeApiError(error, 'PUT /customers/{id}');
      if (mapped) {
        throw mapped;
      }
      throw error;
    }
  }

  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  let provisioned;
  try {
    provisioned = await kycProvider.provisionVirtualAccount({
      customerId,
      currency,
      destinationAddress: space.address,
      idempotencyKey: randomUUID(),
    });
  } catch (error) {
    const mapped = mapBridgeProvisionError(error);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  const accountPayload = {
    providerVirtualAccountId: provisioned.providerVirtualAccountId,
    currency: provisioned.currency,
    paymentRail: provisioned.paymentRail,
    depositInstructions: enrichBridgeDepositInstructions(
      provisioned.depositInstructions,
      {
        developerFeePercent: provisioned.developerFeePercent,
        destination: provisioned.destination,
      },
    ),
    destinationAddress: provisioned.destination?.address ?? space.address,
    status: provisioned.status,
    isApproved: true,
  };

  const row =
    resolvedAccount && !resolvedAccount.providerVirtualAccountId
      ? await updateBankVirtualAccount(
          { id: resolvedAccount.id, ...accountPayload },
          { db },
        )
      : await insertBankVirtualAccount(
          {
            bankCustomerId: resolvedCustomer.id,
            provider: DEFAULT_BANK_PROVIDER,
            ...accountPayload,
          },
          { db },
        );

  return {
    ...mapBankVirtualAccountToPublic(row),
    created: !resolvedAccount,
  };
}
