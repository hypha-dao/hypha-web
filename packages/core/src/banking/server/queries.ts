import { and, eq } from 'drizzle-orm';

import type { DbConfig } from '../../common/server/types';
import type { BankProvider } from '../types';
import {
  bankCustomers,
  bankVirtualAccounts,
  type BankCustomer,
  type BankVirtualAccount,
} from '@hypha-platform/storage-postgres';

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
      and(
        eq(bankCustomers.spaceId, spaceId),
        eq(bankCustomers.provider, provider),
      ),
    )
    .limit(1);

  return row ?? null;
};

type FindBankVirtualAccountsByCustomerInput = {
  bankCustomerId: number;
};

export const findBankVirtualAccountsByCustomer = async (
  { bankCustomerId }: FindBankVirtualAccountsByCustomerInput,
  { db }: DbConfig,
): Promise<BankVirtualAccount[]> => {
  return db
    .select()
    .from(bankVirtualAccounts)
    .where(eq(bankVirtualAccounts.bankCustomerId, bankCustomerId));
};

type FindBankVirtualAccountByCorridorAndCustomerInput = {
  bankCustomerId: number;
  currency: string;
  paymentRail: string;
};

export const findBankVirtualAccountByCorridorAndCustomer = async (
  {
    bankCustomerId,
    currency,
    paymentRail,
  }: FindBankVirtualAccountByCorridorAndCustomerInput,
  { db }: DbConfig,
): Promise<BankVirtualAccount | null> => {
  const [row] = await db
    .select()
    .from(bankVirtualAccounts)
    .where(
      and(
        eq(bankVirtualAccounts.bankCustomerId, bankCustomerId),
        eq(bankVirtualAccounts.currency, currency),
        eq(bankVirtualAccounts.paymentRail, paymentRail),
      ),
    )
    .limit(1);

  return row ?? null;
};
