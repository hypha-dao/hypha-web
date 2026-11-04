import { and, eq } from 'drizzle-orm';

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

type FindBankCustomerByPersonAndProviderInput = {
  personId: number;
  provider: BankProvider;
};

export const findBankCustomerByPersonAndProvider = async (
  { personId, provider }: FindBankCustomerByPersonAndProviderInput,
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .select()
    .from(bankCustomers)
    .where(
      and(
        eq(bankCustomers.personId, personId),
        eq(bankCustomers.provider, provider),
      ),
    )
    .limit(1);

  return row ?? null;
};

/** All of a space's `bank_customers` rows, one per provider (D3) — for the multi-provider status read. */
export const findBankCustomersBySpace = async (
  spaceId: number,
  { db }: DbConfig,
): Promise<BankCustomer[]> => {
  return db
    .select()
    .from(bankCustomers)
    .where(eq(bankCustomers.spaceId, spaceId));
};

/** All of a person's `bank_customers` rows, one per provider (D3) — for the multi-provider status read. */
export const findBankCustomersByPerson = async (
  personId: number,
  { db }: DbConfig,
): Promise<BankCustomer[]> => {
  return db
    .select()
    .from(bankCustomers)
    .where(eq(bankCustomers.personId, personId));
};

/** Looks up the pending confirmation row a confirmation-JWT `jti` correlates to (#2288). */
export const findBankCustomerByNonce = async (
  jwtNonce: string,
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .select()
    .from(bankCustomers)
    .where(eq(bankCustomers.jwtNonce, jwtNonce))
    .limit(1);

  return row ?? null;
};
