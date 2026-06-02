import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import type { DbConfig } from '../../common/server/types';
import type { BankProvider } from '../types';
import {
  bankCustomers,
  type BankCustomer,
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

type FindBankCustomerByNonceInput = {
  nonce: string;
};

export const findBankCustomerByNonce = async (
  { nonce }: FindBankCustomerByNonceInput,
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .select()
    .from(bankCustomers)
    .where(eq(bankCustomers.jwtNonce, nonce))
    .limit(1);

  return row ?? null;
};

type FindPendingBankCustomerForSpaceInput = {
  spaceId: number;
  provider: BankProvider;
};

export const findPendingBankCustomerForSpace = async (
  { spaceId, provider }: FindPendingBankCustomerForSpaceInput,
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .select()
    .from(bankCustomers)
    .where(
      and(
        eq(bankCustomers.spaceId, spaceId),
        eq(bankCustomers.provider, provider),
        isNotNull(bankCustomers.jwtNonce),
        isNull(bankCustomers.providerKycLinkId),
      ),
    )
    .limit(1);

  return row ?? null;
};

type FindBankCustomerByProviderCustomerIdInput = {
  providerCustomerId: string;
  provider: BankProvider;
};

export const findBankCustomerByProviderCustomerId = async (
  { providerCustomerId, provider }: FindBankCustomerByProviderCustomerIdInput,
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .select()
    .from(bankCustomers)
    .where(
      and(
        eq(bankCustomers.providerCustomerId, providerCustomerId),
        eq(bankCustomers.provider, provider),
      ),
    )
    .limit(1);

  return row ?? null;
};
