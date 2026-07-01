import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import { bridgeListTransfers } from '../../common/server/bridge-client';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { ListBankTransfersInput, PaginatedBankTransfers } from '../types';
import { resolveSpaceExecutorAddress } from '../../space/server/resolve-space-executor-address';
import { findBankCustomerBySpaceAndProvider } from './queries';
import {
  bridgeTransferTargetsSpace,
  mapBridgeTransferToPublic,
} from './map-bridge-resources';

export async function getSpaceBankTransfers(
  space: Pick<Space, 'id' | 'web3SpaceId'>,
  input: ListBankTransfersInput,
  { db }: { db: DatabaseInstance },
): Promise<PaginatedBankTransfers> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return { transfers: [], hasMore: false, nextCursor: null };
  }

  const customerId = customer.providerCustomerId;

  if (!customerId) {
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

  const listed = await bridgeListTransfers(customerId, {
    limit: input.limit ?? 25,
    starting_after: input.startingAfter,
    ending_before: input.endingBefore,
  });

  const scoped = listed.data.filter((row) =>
    bridgeTransferTargetsSpace(row, treasuryAddress),
  );

  if (process.env.NODE_ENV !== 'production') {
    console.info('[banking] getSpaceBankTransfers result', {
      spaceSlug: input.spaceSlug,
      bridgeCount: listed.data.length,
      afterTreasuryFilter: scoped.length,
    });
  }

  const transfers = scoped.map((row) =>
    mapBridgeTransferToPublic(row, treasuryAddress ?? ''),
  );

  // Cursor must come from the raw Bridge page, not the treasury-filtered
  // subset: if a page filters empty while Bridge still has_more, we must keep
  // advancing or later transfers are silently hidden.
  const lastRaw = listed.data.at(-1);

  return {
    transfers,
    hasMore: listed.has_more ?? false,
    nextCursor: listed.has_more && lastRaw ? lastRaw.id : null,
  };
}
