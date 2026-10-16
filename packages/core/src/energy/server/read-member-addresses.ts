import 'server-only';

import type { DbConfig } from '../../server';
import { web3Client } from '../../common/server/web3-rpc/client';
import { energyPpaV2Abi } from '../client/contracts';
import {
  findEnergyCommunityBySpaceSlug,
  isMissingEnergyCommunitiesTableError,
} from './queries';

export type EnergyCommunityMemberAddressRead =
  | { status: 'no-community' }
  | { status: 'unavailable' }
  | { status: 'ok'; addresses: ReadonlySet<string> };

/**
 * On-chain energy-community member wallets for a space.
 * `no-community` means the space has no energy activation row.
 * `unavailable` means the community exists but the chain read failed — callers
 * should keep showing the full space roster rather than hiding everyone.
 */
export async function readEnergyCommunityMemberAddresses(
  spaceSlug: string,
  { db }: DbConfig,
): Promise<EnergyCommunityMemberAddressRead> {
  let row: Awaited<ReturnType<typeof findEnergyCommunityBySpaceSlug>>;
  try {
    row = await findEnergyCommunityBySpaceSlug(spaceSlug, { db });
  } catch (error) {
    if (isMissingEnergyCommunitiesTableError(error)) {
      return { status: 'no-community' };
    }
    throw error;
  }

  if (!row) return { status: 'no-community' };

  const proxy = row.energyCommunity.communityProxyAddress?.trim().toLowerCase();
  if (!proxy || !/^0x[a-f0-9]{40}$/.test(proxy)) {
    return { status: 'unavailable' };
  }

  try {
    const addresses = (await web3Client.readContract({
      address: proxy as `0x${string}`,
      abi: energyPpaV2Abi,
      functionName: 'getMemberAddresses',
    })) as readonly string[];

    return {
      status: 'ok',
      addresses: new Set(addresses.map((address) => address.toLowerCase())),
    };
  } catch (error) {
    console.warn(
      `[energy] failed to read community members for ${spaceSlug}:`,
      error,
    );
    return { status: 'unavailable' };
  }
}
