import { getAddress } from 'viem';
import type { Space } from '../../../space/types';

function norm(a: string): string {
  return a.toLowerCase();
}

/** Normalize to checksummed addresses for stable encoding */
export function normalizeWhitelistAddresses(
  addrs: `0x${string}`[],
): `0x${string}`[] {
  const seen = new Set<string>();
  const out: `0x${string}`[] = [];
  for (const a of addrs) {
    try {
      const c = getAddress(a);
      if (!seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        out.push(c as `0x${string}`);
      }
    } catch {
      // skip invalid
    }
  }
  return out;
}

/**
 * Diff baseline vs target for batchSet*(accounts, allowed).
 * - Addresses only in target → allowed true (add)
 * - Addresses only in baseline → allowed false (remove)
 */
export function diffWhitelistForBatchSet(
  baseline: `0x${string}`[],
  target: `0x${string}`[],
): { accounts: `0x${string}`[]; allowed: boolean[] } {
  const base = normalizeWhitelistAddresses(baseline);
  const tgt = normalizeWhitelistAddresses(target);
  const baseSet = new Set(base.map((a) => norm(a)));
  const tgtSet = new Set(tgt.map((a) => norm(a)));
  const accounts: `0x${string}`[] = [];
  const allowed: boolean[] = [];

  for (const t of tgt) {
    if (!baseSet.has(norm(t))) {
      accounts.push(t);
      allowed.push(true);
    }
  }
  for (const b of base) {
    if (!tgtSet.has(norm(b))) {
      accounts.push(b);
      allowed.push(false);
    }
  }

  return { accounts, allowed };
}

/**
 * Split form whitelist rows into member addresses (for `batchSet*Whitelist`) and
 * web3 space ids (for `batchAdd/Remove*WhitelistSpaces`). Space rows must resolve
 * via `spaces[]` (address + web3SpaceId).
 */
export function splitWhitelistFormToTargets(
  entries:
    | Array<{
        type?: 'member' | 'space';
        address: string;
      }>
    | undefined
    | null,
  spaces: Space[],
): { memberAddresses: `0x${string}`[]; spaceIds: number[] } {
  const memberAddresses: `0x${string}`[] = [];
  const spaceIds: number[] = [];
  if (!entries?.length) {
    return { memberAddresses, spaceIds };
  }

  const spaceByAddress = new Map<string, Space>();
  for (const s of spaces) {
    if (!s.address?.startsWith('0x') || s.web3SpaceId == null) {
      continue;
    }
    try {
      spaceByAddress.set(norm(getAddress(s.address as `0x${string}`)), s);
    } catch {
      // skip invalid
    }
  }

  for (const e of entries) {
    if (!e.address?.startsWith('0x')) {
      continue;
    }
    try {
      const addr = getAddress(e.address as `0x${string}`);
      if (e.type === 'space') {
        const sp = spaceByAddress.get(norm(addr));
        const wid = sp?.web3SpaceId;
        if (wid != null && Number.isFinite(Number(wid))) {
          spaceIds.push(Number(wid));
        }
        continue;
      }
      memberAddresses.push(addr as `0x${string}`);
    } catch {
      // skip invalid
    }
  }

  return {
    memberAddresses: normalizeWhitelistAddresses(memberAddresses),
    spaceIds: [...new Set(spaceIds)].filter(
      (n) => Number.isFinite(n) && n >= 0,
    ),
  };
}
