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
import { BankOnboardingError } from './errors';
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
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';

function mapBridgeProvisionError(error: unknown): BankOnboardingError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const status = (error as Error & { status?: number }).status;
  if (status !== undefined && status >= 400 && status < 500) {
    console.error('Bridge virtual account provisioning failed:', error);
    const body = (error as Error & { body?: unknown }).body;
    const code =
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof (body as { code: unknown }).code === 'string'
        ? (body as { code: string }).code
        : null;

    if (code === 'missing_address_data') {
      return new BankOnboardingError(
        'Bridge customer is missing a complete physical address. In sandbox, use Simulate KYB approval or retry after addresses are set on the customer.',
        400,
      );
    }

    return new BankOnboardingError(
      'This payment corridor was not verified during KYB. Complete verification for this corridor in Bridge, or choose a different currency.',
      400,
    );
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
      ...mapBankVirtualAccountToPublic(
        existing,
        customer.kycStatus === 'approved',
      ),
      created: false,
    };
  }

  let resolvedCustomer = customer;

  if (resolvedCustomer.kycStatus !== 'approved') {
    const synced = await syncBankCustomerKycFromBridge(resolvedCustomer, {
      db,
    });
    resolvedCustomer = synced.customer;

    if (!synced.isApproved) {
      throw new BankOnboardingError(
        'KYB is not yet approved. Complete verification before setting up deposit accounts.',
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
  };

  const row =
    existing && !existing.providerVirtualAccountId
      ? await updateBankVirtualAccount(
          { id: existing.id, ...accountPayload },
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
    ...mapBankVirtualAccountToPublic(row, true),
    created: !existing,
  };
}
