import 'server-only';

import { web3Client } from '../../common/server/web3-rpc/client';
import { getSpaceDetails } from '../client/web3/dao-space-factory/get-space-details';
import type { Person } from '../../people/types';
import type { Space } from '../types';
import type { DbConfig } from '../../server';
import { findPersonByAddresses } from '../../people/server/queries';
import { findSpaceByAddresses } from './queries';

/**
 * Members of the active space for ownership-token **To** whitelist UI: same source as
 * `GET /api/v1/spaces/[slug]/members` — on-chain `getSpaceDetails(spaceId).members`,
 * resolved to DB people (wallets) and spaces (space-as-member contract addresses).
 * Excludes parent/organisation linkage: only addresses returned by the space contract.
 */
export async function getActiveSpaceMembersForOwnershipToWhitelist(
  { web3SpaceId }: { web3SpaceId: number | null | undefined },
  { db }: DbConfig,
): Promise<{ persons: Person[]; spaces: Space[] }> {
  if (
    web3SpaceId == null ||
    !Number.isFinite(web3SpaceId) ||
    web3SpaceId <= 0
  ) {
    return { persons: [], spaces: [] };
  }

  let memberAddresses: readonly `0x${string}`[];
  try {
    const details = await web3Client.readContract(
      getSpaceDetails({ spaceId: BigInt(web3SpaceId) }),
    );
    memberAddresses = details[4] as readonly `0x${string}`[];
  } catch (err) {
    console.error(
      'getActiveSpaceMembersForOwnershipToWhitelist: getSpaceDetails failed',
      err,
    );
    return { persons: [], spaces: [] };
  }

  if (!memberAddresses?.length) {
    return { persons: [], spaces: [] };
  }

  const [personsRes, spacesRes] = await Promise.all([
    findPersonByAddresses([...memberAddresses], {}, { db }),
    findSpaceByAddresses([...memberAddresses], {}, { db }),
  ]);

  const persons = personsRes.data.filter(
    (p) => !!p.address?.trim() && p.address.startsWith('0x'),
  );
  const spaces = spacesRes.data.filter(
    (s) => !!s.address?.trim() && s.address.startsWith('0x'),
  );

  return { persons, spaces };
}
