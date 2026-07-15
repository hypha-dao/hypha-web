import 'server-only';

import { web3Client } from '../../common/server/web3-rpc/client';

const ownershipTokenNameAbi = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

/**
 * Read the human-readable name from a source ownership token (RegularSpaceToken).
 */
const normalizeOwnershipTokenAddress = (
  tokenAddress: `0x${string}` | string | null | undefined,
): `0x${string}` | null => {
  if (!tokenAddress) return null;
  const normalized = tokenAddress.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null;
  if (normalized === '0x0000000000000000000000000000000000000000') return null;
  return normalized as `0x${string}`;
};

export async function readOwnershipTokenName(
  tokenAddress: `0x${string}` | string | null | undefined,
): Promise<string | null> {
  const normalized = normalizeOwnershipTokenAddress(tokenAddress);
  if (!normalized) return null;

  try {
    const name = await web3Client.readContract({
      address: normalized,
      abi: ownershipTokenNameAbi,
      functionName: 'name',
    });
    const trimmed = String(name).trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/** Batch-read ownership token names, deduplicating addresses and using multicall. */
export async function readOwnershipTokenNames(
  tokenAddresses: readonly (`0x${string}` | string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = [
    ...new Set(
      tokenAddresses
        .map((address) => normalizeOwnershipTokenAddress(address))
        .filter((address): address is `0x${string}` => address !== null),
    ),
  ];

  if (unique.length === 0) return {};

  const results = await web3Client.multicall({
    allowFailure: true,
    contracts: unique.map((address) => ({
      address,
      abi: ownershipTokenNameAbi,
      functionName: 'name' as const,
    })),
  });

  const lookup: Record<string, string> = {};
  for (const [index, address] of unique.entries()) {
    const result = results[index];
    if (result?.status !== 'success') continue;
    const trimmed = String(result.result).trim();
    if (trimmed.length > 0) {
      lookup[address] = trimmed;
    }
  }

  return lookup;
}
