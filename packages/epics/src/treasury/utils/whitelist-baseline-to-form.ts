import { getAddress } from 'viem';
import type { Person, Space } from '@hypha-platform/core/client';

type WhitelistEntry = {
  type: 'member' | 'space';
  address: string;
  includeSpaceMembers?: boolean;
};

function norm(a: string): string {
  return a.toLowerCase();
}

/**
 * Maps flat on-chain whitelist addresses to issue-new-token `transferWhitelist` form rows
 * by matching known member and space contract addresses.
 */
export function buildTransferWhitelistFromBaselineAddresses({
  from,
  to,
  members,
  spaces,
  isOwnershipToken,
}: {
  from: `0x${string}`[];
  to: `0x${string}`[];
  members: Person[];
  spaces: Space[];
  isOwnershipToken: boolean;
}): { from?: WhitelistEntry[]; to?: WhitelistEntry[] } | undefined {
  const memberByAddr = new Map<string, Person>();
  for (const m of members) {
    if (!m.address?.startsWith('0x')) continue;
    try {
      memberByAddr.set(norm(getAddress(m.address as `0x${string}`)), m);
    } catch {
      // skip invalid
    }
  }

  const spaceByAddr = new Map<string, Space>();
  for (const s of spaces) {
    if (!s.address?.startsWith('0x')) continue;
    try {
      spaceByAddr.set(norm(getAddress(s.address as `0x${string}`)), s);
    } catch {
      // skip invalid
    }
  }

  const mapAddr = (addr: `0x${string}`): WhitelistEntry => {
    const key = norm(addr);
    const mem = memberByAddr.get(key);
    if (mem?.address) {
      return {
        type: 'member',
        address: getAddress(mem.address as `0x${string}`),
      };
    }
    const sp = spaceByAddr.get(key);
    if (sp?.address) {
      return {
        type: 'space',
        address: getAddress(sp.address as `0x${string}`),
        includeSpaceMembers: true,
      };
    }
    return {
      type: 'space',
      address: getAddress(addr),
      includeSpaceMembers: true,
    };
  };

  const toEntries = to.map(mapAddr);
  if (isOwnershipToken) {
    /** Receive-only in UI; if chain only has transfer-side entries, surface them as `to` rows */
    if (toEntries.length === 0 && from.length > 0) {
      return { to: from.map(mapAddr) };
    }
    if (toEntries.length === 0) {
      return undefined;
    }
    return { to: toEntries };
  }

  const fromEntries = from.map(mapAddr);
  if (fromEntries.length === 0 && toEntries.length === 0) {
    return undefined;
  }
  return { from: fromEntries, to: toEntries };
}
