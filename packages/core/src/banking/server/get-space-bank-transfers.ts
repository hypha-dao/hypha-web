import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { BankTransferPublic } from '../types';
import { mapBankTransferToPublic } from './map-bank-transfer-public';
import { resolveCustomerApprovedForOperations } from './resolve-customer-approved-for-operations';
import {
  findBankCustomerBySpaceAndProvider,
  findBankTransfersByCustomer,
} from './queries';

export async function getSpaceBankTransfers(
  space: Pick<Space, 'id'>,
  { db }: { db: DatabaseInstance },
): Promise<BankTransferPublic[]> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return [];
  }

  const isApproved = await resolveCustomerApprovedForOperations(customer);

  const transfers = await findBankTransfersByCustomer(
    { bankCustomerId: customer.id },
    { db },
  );

  return transfers
    .map((row) => mapBankTransferToPublic(row, isApproved))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
