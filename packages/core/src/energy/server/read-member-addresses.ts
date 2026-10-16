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

const MEMBER_ADDRESS_CACHE_TTL_MS = 30_000;
const MEMBER_ADDRESS_READ_TIMEOUT_MS = 3_000;

type MemberAddressCacheEntry = {
  expiresAt: number;
  value: Exclude<EnergyCommunityMemberAddressRead, { status: 'unavailable' }>;
};

const memberAddressCache = new Map<string, MemberAddressCacheEntry>();
const memberAddressReads = new Map<
  string,
  Promise<EnergyCommunityMemberAddressRead>
>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('energy member read timed out')),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function readEnergyCommunityMemberAddressesUncached(
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
    const addresses = (await withTimeout(
      web3Client.readContract({
        address: proxy as `0x${string}`,
        abi: energyPpaV2Abi,
        functionName: 'getMemberAddresses',
      }) as Promise<readonly string[]>,
      MEMBER_ADDRESS_READ_TIMEOUT_MS,
    )) as readonly string[];

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

/**
 * On-chain energy-community member wallets for a space.
 * `no-community` means the space has no energy activation row.
 * `unavailable` means the community exists but the chain read failed — callers
 * should keep showing the full space roster rather than hiding everyone.
 *
 * Successful reads are cached for 30s and concurrent callers share one RPC.
 */
export async function readEnergyCommunityMemberAddresses(
  spaceSlug: string,
  config: DbConfig,
): Promise<EnergyCommunityMemberAddressRead> {
  const cacheKey = spaceSlug.trim().toLowerCase();
  const cached = memberAddressCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = memberAddressReads.get(cacheKey);
  if (pending) return pending;

  const read = readEnergyCommunityMemberAddressesUncached(spaceSlug, config)
    .then((value) => {
      if (value.status !== 'unavailable') {
        memberAddressCache.set(cacheKey, {
          expiresAt: Date.now() + MEMBER_ADDRESS_CACHE_TTL_MS,
          value,
        });
      }
      return value;
    })
    .finally(() => {
      memberAddressReads.delete(cacheKey);
    });

  memberAddressReads.set(cacheKey, read);
  return read;
}
