import { getAddress } from 'viem';

export type WhitelistDiffStatus = 'added' | 'removed' | 'unchanged';

function norm(a: string): string {
  return a.toLowerCase();
}

/**
 * Compare pre-proposal on-chain whitelist (`before`) to proposed state (`after`).
 * Every address in either set appears once with + / − / =.
 */
export function buildWhitelistDiffRows(
  before: `0x${string}`[] | undefined,
  after: `0x${string}`[],
): Array<{ address: `0x${string}`; status: WhitelistDiffStatus }> {
  const bSet = new Set(
    (before ?? []).map((x) => {
      try {
        return norm(getAddress(x));
      } catch {
        return norm(x);
      }
    }),
  );
  const aSet = new Set(
    after.map((x) => {
      try {
        return norm(getAddress(x));
      } catch {
        return norm(x);
      }
    }),
  );

  const normToChecksum = new Map<string, `0x${string}`>();
  for (const addr of [...(before ?? []), ...after]) {
    try {
      const c = getAddress(addr);
      normToChecksum.set(norm(c), c as `0x${string}`);
    } catch {
      // skip invalid
    }
  }

  const keys = new Set([...bSet, ...aSet]);
  const rows: Array<{ address: `0x${string}`; status: WhitelistDiffStatus }> =
    [];
  for (const k of keys) {
    const checksum = normToChecksum.get(k);
    if (!checksum) {
      continue;
    }
    const inB = bSet.has(k);
    const inA = aSet.has(k);
    if (inB && inA) {
      rows.push({ address: checksum, status: 'unchanged' });
    } else if (inA && !inB) {
      rows.push({ address: checksum, status: 'added' });
    } else if (inB && !inA) {
      rows.push({ address: checksum, status: 'removed' });
    }
  }

  rows.sort((x, y) =>
    x.address.toLowerCase().localeCompare(y.address.toLowerCase()),
  );
  return rows;
}
