import type { BankVirtualAccount } from '@hypha-platform/storage-postgres';
import type { BankVirtualAccountPublic } from '../types';
import { resolveBankOperationLifecycle } from './map-bank-operation-lifecycle';

export function mapBankVirtualAccountToPublic(
  account: BankVirtualAccount,
  isCustomerApproved: boolean,
): BankVirtualAccountPublic {
  const hasProviderResource = Boolean(account.providerVirtualAccountId);
  const { lifecycle, canActivate, canContinueVerification } =
    resolveBankOperationLifecycle({
      status: account.status,
      hasProviderResource,
      isCustomerApproved,
    });

  return {
    id: account.id,
    currency: account.currency,
    paymentRail: account.paymentRail,
    depositInstructions: account.depositInstructions,
    status: account.status,
    lifecycle,
    canActivate,
    canContinueVerification,
  };
}
