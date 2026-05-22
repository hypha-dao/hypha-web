import type { DatabaseInstance } from '../../common/server/types';
import type { BankTransferPublic } from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { executeBridgeBankTransfer } from './execute-bridge-bank-transfer';
import { mapBankTransferToPublic } from './map-bank-transfer-public';
import { updateBankTransfer } from './mutations';
import type { BankKycProvider } from './providers/types';
import { promotePendingBankOperations } from './promote-pending-bank-operations';
import {
  findBankCustomerBySpaceAndProvider,
  findBankTransferById,
} from './queries';
import { authorizeSpaceBankOnboarding } from './authorize-space-bank-onboarding';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';

export type ActivateSpaceBankTransferInput = {
  spaceSlug: string;
  authToken: string;
  transferId: number;
};

export type ActivateSpaceBankTransferOptions = {
  kycProvider?: BankKycProvider;
};

export async function activateSpaceBankTransfer(
  input: ActivateSpaceBankTransferInput,
  { db }: { db: DatabaseInstance },
  options?: ActivateSpaceBankTransferOptions,
): Promise<BankTransferPublic> {
  const space = await findSpaceBySlug({ slug: input.spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const auth = await authorizeSpaceBankOnboarding({
    space,
    authToken: input.authToken,
  });
  if (!auth.authorized) {
    throw new BankOnboardingError(auth.message, auth.httpStatus);
  }

  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );
  if (!customer) {
    throw new BankOnboardingError('Bank customer not found', 404);
  }

  const transfer = await findBankTransferById(
    { id: input.transferId, bankCustomerId: customer.id },
    { db },
  );
  if (!transfer) {
    throw new BankOnboardingError('Transfer not found', 404);
  }

  if (transfer.providerTransferId) {
    return mapBankTransferToPublic(transfer, customer.kycStatus === 'approved');
  }

  let resolvedCustomer = customer;
  const synced = await syncBankCustomerKycFromBridge(resolvedCustomer, { db });
  resolvedCustomer = synced.customer;

  if (!synced.isApproved) {
    throw new BankOnboardingError(
      'Complete business verification before activating this payment request',
      403,
    );
  }

  await promotePendingBankOperations(resolvedCustomer, { db });

  const bridgeResult = await executeBridgeBankTransfer(
    {
      customer: resolvedCustomer,
      space,
      currency: transfer.currency,
      amount: transfer.amount ?? undefined,
    },
    { db },
    options,
  );

  const updated = await updateBankTransfer(
    {
      id: transfer.id,
      providerTransferId: bridgeResult.providerTransferId,
      currency: bridgeResult.currency,
      paymentRail: bridgeResult.paymentRail,
      amount: bridgeResult.amount,
      depositMessage: bridgeResult.depositMessage,
      status: bridgeResult.status,
      depositInstructions: bridgeResult.depositInstructions,
    },
    { db },
  );

  return mapBankTransferToPublic(updated, true);
}
