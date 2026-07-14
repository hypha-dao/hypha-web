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
export async function readOwnershipTokenName(
  tokenAddress: `0x${string}` | string | null | undefined,
): Promise<string | null> {
  if (!tokenAddress) return null;
  const normalized = tokenAddress.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null;
  if (normalized === '0x0000000000000000000000000000000000000000') return null;

  try {
    const name = await web3Client.readContract({
      address: normalized as `0x${string}`,
      abi: ownershipTokenNameAbi,
      functionName: 'name',
    });
    const trimmed = String(name).trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
