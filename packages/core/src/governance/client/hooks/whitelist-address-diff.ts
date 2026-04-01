import { getAddress } from 'viem';

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
