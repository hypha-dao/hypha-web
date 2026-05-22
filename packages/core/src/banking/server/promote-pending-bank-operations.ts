import { and, eq, isNull } from 'drizzle-orm';

import {
  bankTransfers,
  bankVirtualAccounts,
  type BankCustomer,
} from '@hypha-platform/storage-postgres';
import type { DatabaseInstance } from '../../common/server/types';
import {
  BANK_OPERATION_PENDING_ACTIVATION,
  BANK_OPERATION_PENDING_KYB,
} from '../constants';
import { updateBankTransfer } from './mutations';

export async function promotePendingBankOperations(
  customer: BankCustomer,
  { db }: { db: DatabaseInstance },
): Promise<void> {
  if (customer.kycStatus !== 'approved') {
    return;
  }

  const now = new Date();

  await db
    .update(bankTransfers)
    .set({
      status: BANK_OPERATION_PENDING_ACTIVATION,
      updatedAt: now,
    })
    .where(
      and(
        eq(bankTransfers.bankCustomerId, customer.id),
        eq(bankTransfers.status, BANK_OPERATION_PENDING_KYB),
        isNull(bankTransfers.providerTransferId),
      ),
    );

  await db
    .update(bankVirtualAccounts)
    .set({
      status: BANK_OPERATION_PENDING_ACTIVATION,
      updatedAt: now,
    })
    .where(
      and(
        eq(bankVirtualAccounts.bankCustomerId, customer.id),
        eq(bankVirtualAccounts.status, BANK_OPERATION_PENDING_KYB),
        isNull(bankVirtualAccounts.providerVirtualAccountId),
      ),
    );
}
