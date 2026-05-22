import type { DatabaseInstance } from '../../common/server/types';
import {
  BANK_OPERATION_PENDING_KYB,
  DEFAULT_BANK_PROVIDER,
  getTransferSourceRailForCurrency,
} from '../constants';
import type {
  CreateSpaceBankTransferResult,
  RequestSpaceBankTransferInput,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { BankOnboardingError } from './errors';
import { ensureSpaceBankCustomer } from './ensure-space-bank-customer';
import { executeBridgeBankTransfer } from './execute-bridge-bank-transfer';
import { insertBankTransfer, updateBankTransfer } from './mutations';
import { mapBankTransferToPublic } from './map-bank-transfer-public';
import type { BankKycProvider } from './providers/types';
import { promotePendingBankOperations } from './promote-pending-bank-operations';
import { resolveBridgeKycEndorsements } from './providers/bridge/endorsements';

export type CreateSpaceBankTransferOptions = {
  kycProvider?: BankKycProvider;
};

export async function createSpaceBankTransfer(
  input: RequestSpaceBankTransferInput,
  { db }: { db: DatabaseInstance },
  options?: CreateSpaceBankTransferOptions,
): Promise<CreateSpaceBankTransferResult> {
  const { spaceSlug, authToken, currency, amount } = input;

  const paymentRail = getTransferSourceRailForCurrency(currency);
  if (!paymentRail) {
    throw new BankOnboardingError('Unsupported currency', 400);
  }

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const endorsements = resolveBridgeKycEndorsements(input.endorsements);

  const ensured = await ensureSpaceBankCustomer(
    {
      space,
      authToken,
      legalName: input.legalName,
      contactEmail: input.contactEmail,
      endorsements,
      redirectUri: input.redirectUri,
    },
    { db },
    options,
  );

  let customer = ensured.customer;
  if (ensured.isApproved) {
    await promotePendingBankOperations(customer, { db });
    customer = ensured.customer;
  }

  const isApproved = customer.kycStatus === 'approved';

  if (!isApproved) {
    const inserted = await insertBankTransfer(
      {
        bankCustomerId: customer.id,
        provider: DEFAULT_BANK_PROVIDER,
        providerTransferId: null,
        currency,
        paymentRail,
        amount: amount ?? null,
        depositMessage: null,
        status: BANK_OPERATION_PENDING_KYB,
        depositInstructions: {},
        destinationAddress: space.address ?? '',
      },
      { db },
    );

    return mapBankTransferToPublic(inserted, false);
  }

  const bridgeResult = await executeBridgeBankTransfer(
    { customer, space, currency, amount },
    { db },
    options,
  );

  const inserted = await insertBankTransfer(
    {
      bankCustomerId: customer.id,
      provider: DEFAULT_BANK_PROVIDER,
      providerTransferId: bridgeResult.providerTransferId,
      currency: bridgeResult.currency,
      paymentRail: bridgeResult.paymentRail,
      amount: bridgeResult.amount,
      depositMessage: bridgeResult.depositMessage,
      status: bridgeResult.status,
      depositInstructions: bridgeResult.depositInstructions,
      destinationAddress: bridgeResult.destinationAddress,
    },
    { db },
  );

  return mapBankTransferToPublic(inserted, true);
}
