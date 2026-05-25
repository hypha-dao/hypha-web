import type { DatabaseInstance } from '../../common/server/types';
import {
  BANK_OPERATION_PENDING_KYB,
  currenciesToEndorsements,
  DEFAULT_BANK_PROVIDER,
  resolveBankTransferCorridor,
  type BankVirtualAccountCurrency,
} from '../constants';
import type {
  CreateSpaceBankTransferResult,
  RequestSpaceBankTransferInput,
} from '../types';
import { findSpaceBySlug } from '../../space/server/queries';
import { resolveSpaceExecutorAddress } from '../../space/server/resolve-space-executor-address';
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
  const { spaceSlug, authToken, amount } = input;

  const corridor = resolveBankTransferCorridor({
    corridorKey: input.corridorKey,
    currency: input.currency,
  });
  if (!corridor) {
    throw new BankOnboardingError('Unsupported transfer corridor', 400);
  }

  const { currency, paymentRail } = corridor;

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    throw new BankOnboardingError('Space not found', 404);
  }

  const endorsements = resolveBridgeKycEndorsements(
    input.endorsements ??
      currenciesToEndorsements([currency as BankVirtualAccountCurrency]),
  );

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

  const treasuryAddress = (await resolveSpaceExecutorAddress(space)) ?? '';

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
        destinationAddress: treasuryAddress,
      },
      { db },
    );

    return mapBankTransferToPublic(inserted, false);
  }

  const bridgeResult = await executeBridgeBankTransfer(
    { customer, space, currency, paymentRail, amount },
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
