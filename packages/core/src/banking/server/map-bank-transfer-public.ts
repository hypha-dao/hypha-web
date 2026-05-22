import type { BankTransfer } from '@hypha-platform/storage-postgres';
import type { BankTransferPublic } from '../types';
import { resolveBankOperationLifecycle } from './map-bank-operation-lifecycle';

export function mapBankTransferToPublic(
  transfer: BankTransfer,
  isCustomerApproved: boolean,
): BankTransferPublic {
  const hasProviderResource = Boolean(transfer.providerTransferId);
  const { lifecycle, canActivate, canContinueVerification } =
    resolveBankOperationLifecycle({
      status: transfer.status,
      hasProviderResource,
      isCustomerApproved,
    });

  return {
    id: transfer.id,
    currency: transfer.currency,
    paymentRail: transfer.paymentRail,
    amount: transfer.amount,
    depositMessage: transfer.depositMessage,
    status: transfer.status,
    depositInstructions: transfer.depositInstructions,
    createdAt: transfer.createdAt.toISOString(),
    lifecycle,
    canActivate,
    canContinueVerification,
  };
}
