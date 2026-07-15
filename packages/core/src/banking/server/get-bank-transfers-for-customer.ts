import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { bridgeListTransfers } from '../../common/server/bridge-client';
import type { PaginatedBankTransfers } from '../types';
import {
  bridgeTransferTargetsSpace,
  mapBridgeTransferToPublic,
} from './map-bridge-resources';

export type BankTransfersListOptions = {
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
};

/**
 * Owner-agnostic core: lists Bridge transfers for a resolved bank customer,
 * scoped to a destination address. Space/person wrappers resolve their own
 * customer + destination address first, then delegate here.
 */
export async function getBankTransfersForCustomer(
  customer: BankCustomer | null,
  destinationAddress: string | null,
  input: BankTransfersListOptions,
): Promise<PaginatedBankTransfers> {
  if (!customer) {
    return { transfers: [], hasMore: false, nextCursor: null };
  }

  const customerId = customer.providerCustomerId;

  if (!customerId) {
    return { transfers: [], hasMore: false, nextCursor: null };
  }

  const listed = await bridgeListTransfers(customerId, {
    limit: input.limit ?? 25,
    starting_after: input.startingAfter,
    ending_before: input.endingBefore,
  });

  const scoped = listed.data.filter((row) =>
    bridgeTransferTargetsSpace(row, destinationAddress),
  );

  const transfers = scoped.map((row) =>
    mapBridgeTransferToPublic(row, destinationAddress ?? ''),
  );

  // Cursor must come from the raw Bridge page, not the destination-filtered
  // subset: if a page filters empty while Bridge still has_more, we must keep
  // advancing or later transfers are silently hidden.
  const lastRaw = listed.data.at(-1);

  return {
    transfers,
    hasMore: listed.has_more ?? false,
    nextCursor: listed.has_more && lastRaw ? lastRaw.id : null,
  };
}
