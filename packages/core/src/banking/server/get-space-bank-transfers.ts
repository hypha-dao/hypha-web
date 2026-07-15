import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { ListBankTransfersInput, PaginatedBankTransfers } from '../types';
import { resolveSpaceExecutorAddress } from '../../space/server/resolve-space-executor-address';
import { findBankCustomerBySpaceAndProvider } from './queries';
import { getBankTransfersForCustomer } from './get-bank-transfers-for-customer';

export async function getSpaceBankTransfers(
  space: Pick<Space, 'id' | 'web3SpaceId'>,
  input: ListBankTransfersInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankTransfers> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer || !customer.providerCustomerId) {
    return { transfers: [], hasMore: false, nextCursor: null };
  }

  const treasuryAddress = await resolveSpaceExecutorAddress(space);

  if (process.env.NODE_ENV !== 'production') {
    console.info('[banking] getSpaceBankTransfers', {
      spaceId: space.id,
      spaceSlug: input.spaceSlug,
      bankCustomerId: customer.id,
      treasuryAddress,
    });
  }

  const result = await getBankTransfersForCustomer(customer, treasuryAddress, {
    limit: input.limit,
    startingAfter: input.startingAfter,
    endingBefore: input.endingBefore,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.info('[banking] getSpaceBankTransfers result', {
      spaceSlug: input.spaceSlug,
      afterTreasuryFilter: result.transfers.length,
    });
  }

  return result;
}
