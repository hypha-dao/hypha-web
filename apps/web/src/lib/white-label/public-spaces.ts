import { web3Client } from '@hypha-platform/core/server';
import { getSpaceVisibility } from '@hypha-platform/core/client';

/**
 * Server only (reads the chain): deliberately not exported from `./index`.
 *
 * A mapped host serves Space records of its own Space and of Spaces whose
 * on-chain access level is PUBLIC, and nothing else. The organisation route
 * returns a whole tree (parents, siblings, children); on a host this keeps only
 * what an anonymous caller may read. The main app is not affected: this runs
 * only for requests that carry the host's Space header.
 *
 * Interim: when the main app enforces visibility on this route (#2652), this
 * filter becomes redundant and should be removed.
 */
const PUBLIC_LEVEL = 0;
const CACHE_TTL_MS = 30_000;
const BATCH_SIZE = 10;

/** Access level of a Space (0 PUBLIC .. 3 SPACE), or null when it cannot be read. */
export type SpaceLevelReader = (web3SpaceId: number) => Promise<number | null>;

const cache = new Map<number, { level: number; expires: number }>();

/** Test hook. */
export function resetPublicSpacesCache(): void {
  cache.clear();
}

export const readSpaceLevel: SpaceLevelReader = async (web3SpaceId) => {
  const hit = cache.get(web3SpaceId);
  if (hit && hit.expires > Date.now()) return hit.level;
  try {
    const visibility = await web3Client.readContract(
      getSpaceVisibility({ spaceId: BigInt(web3SpaceId) }),
    );
    const level = Number(
      'access' in visibility ? visibility.access : visibility[1],
    );
    if (!Number.isFinite(level)) return null;
    cache.set(web3SpaceId, { level, expires: Date.now() + CACHE_TTL_MS });
    return level;
  } catch {
    return null;
  }
};

/**
 * Keeps the host's own Space and every Space whose level reads as PUBLIC.
 * Fails closed: a Space without an on-chain id, or whose level cannot be read,
 * is dropped. Order is kept. Reads run in small batches.
 */
export async function keepPublicSpaces<
  T extends { web3SpaceId?: number | null },
>(
  spaces: readonly T[],
  ownWeb3SpaceId: number | null,
  read: SpaceLevelReader = readSpaceLevel,
): Promise<T[]> {
  const keep: boolean[] = [];
  for (let start = 0; start < spaces.length; start += BATCH_SIZE) {
    const batch = spaces.slice(start, start + BATCH_SIZE);
    const flags = await Promise.all(
      batch.map(async ({ web3SpaceId }) => {
        if (
          typeof web3SpaceId !== 'number' ||
          !Number.isSafeInteger(web3SpaceId)
        ) {
          return false;
        }
        if (ownWeb3SpaceId !== null && web3SpaceId === ownWeb3SpaceId) {
          return true;
        }
        return (await read(web3SpaceId)) === PUBLIC_LEVEL;
      }),
    );
    keep.push(...flags);
  }
  return spaces.filter((_, index) => keep[index]);
}
