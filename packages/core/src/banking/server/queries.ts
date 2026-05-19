import { and, eq } from 'drizzle-orm';

import type { DbConfig } from '../../common/server/types';
import type { BankProvider } from '../types';
import { bankCustomers, type BankCustomer } from '@hypha-platform/storage-postgres';

type FindBankCustomerBySpaceAndProviderInput = {
  spaceId: number;
  provider: BankProvider;
};

export const findBankCustomerBySpaceAndProvider = async (
  { spaceId, provider }: FindBankCustomerBySpaceAndProviderInput,
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .select()
    .from(bankCustomers)
    .where(
      and(eq(bankCustomers.spaceId, spaceId), eq(bankCustomers.provider, provider)),
    )
    .limit(1);

  return row ?? null;
};
