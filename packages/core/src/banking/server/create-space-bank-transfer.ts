import { randomUUID } from 'node:crypto';

import type { DatabaseInstance } from '../../common/server/types';
import {
  BRIDGE_DEFAULT_DESTINATION_CURRENCY,
  isAllowedBridgeDestinationCurrency,
} from '../bridge-destination-currencies';
import {
  DEFAULT_BANK_PROVIDER,
  resolveBankTransferCorridor,
} from '../constants';
import type {
  CreateSpaceBankTransferResult,
  RequestSpaceBankTransferInput,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { executeBridgeBankTransfer } from './execute-bridge-bank-transfer';
import { mapBridgeTransferToPublic } from './map-bridge-resources';
import {
  buildRailStatuses,
  loadBankingProviderState,
  resolveCustomerApproved,
} from './providers/bridge/banking-provider-state';
import { isBridgeEndorsementApproved } from './bridge-customer-endorsements';

export async function createSpaceBankTransfer(
  input: RequestSpaceBankTransferInput,
  { db }: { db: DatabaseInstance },
): Promise<CreateSpaceBankTransferResult> {
  const { spaceSlug, authToken, amount } = input;
  const destinationCurrency =
    input.destinationCurrency?.toLowerCase() ??
    BRIDGE_DEFAULT_DESTINATION_CURRENCY;

  const corridor = resolveBankTransferCorridor({
    corridorKey: input.railKey ?? input.corridorKey,
    currency: input.currency,
  });
  if (!corridor) {
    throw new BankOnboardingError('Unsupported transfer rail', 400);
  }

  const { currency, paymentRail } = corridor;

  if (
    !isAllowedBridgeDestinationCurrency({
      sourceRail: paymentRail,
      destinationCurrency,
    })
  ) {
    throw new BankOnboardingError(
      'Destination currency is not supported for this corridor',
      400,
    );
  }

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const auth = await authorizeSpaceBankOnboarding({ space, authToken });
  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );
  if (!customer) {
    throw new BankOnboardingError(
      'Complete business verification before creating transfers',
      404,
    );
  }

  if (!(await resolveCustomerApproved(customer))) {
    throw new BankOnboardingError(
      'Complete business verification before creating transfers',
      403,
    );
  }

  const state = await loadBankingProviderState(customer);
  const rails = buildRailStatuses({ customer, state });
  const rail = rails.find(
    (r) =>
      r.currency === currency.toLowerCase() &&
      r.paymentRail.toLowerCase() === paymentRail.toLowerCase(),
  );

  if (!rail || !isBridgeEndorsementApproved(rail.endorsementStatus)) {
    throw new BankOnboardingError(
      'This payment rail is not yet approved. Complete verification in Banking settings.',
      403,
    );
  }

  const bridgeResult = await executeBridgeBankTransfer(
    { customer, space, currency, paymentRail, destinationCurrency, amount },
    { db },
  );

  return mapBridgeTransferToPublic(
    {
      id: bridgeResult.providerTransferId,
      state: bridgeResult.status,
      amount: bridgeResult.amount,
      currency: bridgeResult.currency,
      source: {
        payment_rail: bridgeResult.paymentRail,
        currency: bridgeResult.currency,
      },
      source_deposit_instructions: bridgeResult.depositInstructions,
      destination: {
        to_address: bridgeResult.destinationAddress,
        payment_rail: 'base',
        currency: destinationCurrency,
      },
    },
    bridgeResult.destinationAddress,
  );
}
