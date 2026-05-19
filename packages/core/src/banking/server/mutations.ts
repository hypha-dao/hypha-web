import type { DbConfig } from '../../common/server/types';
import type { BankEntityType, BankProvider } from '../types';
import { bankCustomers, type BankCustomer } from '@hypha-platform/storage-postgres';

export type InsertBankCustomerInput = {
  spaceId: number;
  adminPersonId: number;
  entityType: BankEntityType;
  provider: BankProvider;
  providerCustomerId: string | null;
  providerKycLinkId: string;
  name: string;
  contactEmail: string;
  endorsements: string[];
  kycStatus: string;
  tosStatus: string | null;
  kycLink: string | null;
  tosLink: string | null;
  idempotencyKey: string;
};

export const insertBankCustomer = async (
  input: InsertBankCustomerInput,
  { db }: DbConfig,
): Promise<BankCustomer> => {
  const [row] = await db.insert(bankCustomers).values(input).returning();

  if (!row) {
    throw new Error('Failed to insert bank customer');
  }

  return row;
};
