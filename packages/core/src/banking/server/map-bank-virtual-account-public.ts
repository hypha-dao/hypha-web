import type { BankVirtualAccount } from '@hypha-platform/storage-postgres';
import type { BankVirtualAccountPublic } from '../types';
import { resolveBankOperationLifecycle } from './map-bank-operation-lifecycle';

export function mapBankVirtualAccountToPublic(
  account: BankVirtualAccount,
): BankVirtualAccountPublic {
  const hasProviderResource = Boolean(account.providerVirtualAccountId);
  const isEndorsementApproved =
    hasProviderResource || account.isApproved === true;
  const { lifecycle, canActivate, canContinueVerification } =
    resolveBankOperationLifecycle({
      status: account.status,
      hasProviderResource,
      isEndorsementApproved,
    });

  return {
    id: account.id,
    currency: account.currency,
    paymentRail: account.paymentRail,
    depositInstructions: account.depositInstructions,
    destinationAddress: account.destinationAddress,
    status: account.status,
    isApproved: isEndorsementApproved,
    approvalRegistered: account.isApproved === true,
    lifecycle,
    canActivate,
    canContinueVerification,
  };
}
