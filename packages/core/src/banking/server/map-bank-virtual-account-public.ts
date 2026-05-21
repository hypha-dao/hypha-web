import type { BankVirtualAccount } from '@hypha-platform/storage-postgres';
import type { BankVirtualAccountPublic } from '../types';

export function mapBankVirtualAccountToPublic(
  account: BankVirtualAccount,
): BankVirtualAccountPublic {
  return {
    currency: account.currency,
    paymentRail: account.paymentRail,
    depositInstructions: account.depositInstructions,
    status: account.status,
  };
}
