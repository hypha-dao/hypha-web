/**
 * Diff baseline vs target space IDs for batchAdd / batchRemove whitelist space ops.
 */
export function diffWhitelistSpaceIds(
  baseline: number[],
  target: number[],
): { add: bigint[]; remove: bigint[] } {
  const base = new Set(
    baseline.filter((n) => Number.isFinite(n) && n >= 0).map((n) => n),
  );
  const tgt = new Set(
    target.filter((n) => Number.isFinite(n) && n >= 0).map((n) => n),
  );
  const add: bigint[] = [];
  const remove: bigint[] = [];
  for (const id of tgt) {
    if (!base.has(id)) {
      add.push(BigInt(id));
    }
  }
  for (const id of base) {
    if (!tgt.has(id)) {
      remove.push(BigInt(id));
    }
  }
  return { add, remove };
}
