import { and, eq } from 'drizzle-orm';

import type { DbConfig } from '../../common/server/types';
import type { BankProvider } from '../types';
import {
  bankCustomers,
  bankTransfers,
  bankVirtualAccounts,
  type BankCustomer,
  type BankTransfer,
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

type FindBankTransfersByCustomerInput = {
  bankCustomerId: number;
};

export const findBankTransfersByCustomer = async (
  { bankCustomerId }: FindBankTransfersByCustomerInput,
  { db }: DbConfig,
): Promise<BankTransfer[]> => {
  return db
    .select()
    .from(bankTransfers)
    .where(eq(bankTransfers.bankCustomerId, bankCustomerId));
};

type FindBankTransferByIdInput = {
  id: number;
  bankCustomerId: number;
};

export const findBankTransferById = async (
  { id, bankCustomerId }: FindBankTransferByIdInput,
  { db }: DbConfig,
): Promise<BankTransfer | null> => {
  const [row] = await db
    .select()
    .from(bankTransfers)
    .where(
      and(
        eq(bankTransfers.id, id),
        eq(bankTransfers.bankCustomerId, bankCustomerId),
      ),
    )
    .limit(1);

  return row ?? null;
};

type FindBankVirtualAccountByIdInput = {
  id: number;
  bankCustomerId: number;
};

export const findBankVirtualAccountById = async (
  { id, bankCustomerId }: FindBankVirtualAccountByIdInput,
  { db }: DbConfig,
): Promise<BankVirtualAccount | null> => {
  const [row] = await db
    .select()
    .from(bankVirtualAccounts)
    .where(
      and(
        eq(bankVirtualAccounts.id, id),
        eq(bankVirtualAccounts.bankCustomerId, bankCustomerId),
      ),
    )
    .limit(1);

  return row ?? null;
};
