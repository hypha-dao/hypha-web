import type {
  FairSplitInput,
  FairSplitResult,
  MemberAllocation,
  ExportAllocation,
  SourceAllocation,
  SourceInfo,
  TraceFn,
} from './types';

/**
 * Run the 3-pass fair-split algorithm for one 15-minute interval.
 *
 * Pure function — no I/O, no side effects. All arithmetic is integer (Wh + basis points).
 *
 * Algorithm (from ENERGY_SYSTEM_README.md Part 2):
 *   Pass 1 — Ownership allocation: each member gets their share of each source (cheapest first)
 *   Pass 2 — Surplus redistribution: unused shares go to deficit members, proportional to ownership
 *   Pass 3 — Grid import: remaining deficit filled from the grid
 *   Export:  remaining production (unused after redistribution) is exported
 *
 * Integer rounding: Math.floor is used for all divisions. At most (n-1) Wh of
 * rounding dust per source per pass may remain undistributed and becomes export.
 * This is typically <5 Wh per interval — negligible at scale.
 */
export function fairSplit(
  input: FairSplitInput,
  trace?: TraceFn,
): FairSplitResult {
  const { members, consumption, production, sources } = input;

  const sortedSources = [...sources].sort((a, b) =>
    a.basePricePerKwh < b.basePricePerKwh
      ? -1
      : a.basePricePerKwh > b.basePricePerKwh
      ? 1
      : 0,
  );

  // used[sourceId][memberAddr] = Wh consumed from this source
  const used = new Map<string, Map<string, number>>();
  // surplus[sourceId][memberAddr] = Wh of unused ownership share
  const surplus = new Map<string, Map<string, number>>();
  const deficit = new Map<string, number>();

  for (const source of sortedSources) {
    used.set(source.sourceId, new Map());
    surplus.set(source.sourceId, new Map());
  }

  // ── Pass 1: Ownership allocation ──────────────────────────────────────

  for (const member of members) {
    let remaining = consumption.get(member) ?? 0;

    for (const source of sortedSources) {
      const prod = production.get(source.sourceId) ?? 0;
      const bps = source.ownershipBps.get(member) ?? 0;
      const share = Math.floor((prod * bps) / 10000);
      const usedAmt = Math.min(share, remaining);
      const surplusAmt = share - usedAmt;

      used.get(source.sourceId)!.set(member, usedAmt);
      surplus.get(source.sourceId)!.set(member, surplusAmt);

      trace?.({
        type: 'pass1_member',
        member,
        source: source.sourceId,
        production: prod,
        bps,
        share,
        used: usedAmt,
        surplus: surplusAmt,
        remainingBefore: remaining,
        remainingAfter: remaining - usedAmt,
      });

      remaining -= usedAmt;
    }

    deficit.set(member, remaining);
  }

  if (trace) {
    const surplusPools: Array<{ source: string; pool: number }> = [];
    for (const source of sortedSources) {
      let pool = 0;
      for (const m of members)
        pool += surplus.get(source.sourceId)!.get(m) ?? 0;
      if (pool > 0) surplusPools.push({ source: source.sourceId, pool });
    }
    trace({
      type: 'pass1_summary',
      deficits: members
        .filter((m) => (deficit.get(m) ?? 0) > 0)
        .map((m) => ({ member: m, deficit: deficit.get(m)! })),
      surplusPools,
    });
  }

  // ── Pass 2: Surplus redistribution per source ─────────────────────────

  for (const source of sortedSources) {
    let pool = 0;
    for (const member of members) {
      pool += surplus.get(source.sourceId)!.get(member) ?? 0;
    }
    if (pool === 0) continue;

    redistributeSurplus(
      source,
      pool,
      deficit,
      used.get(source.sourceId)!,
      members,
      sortedSources,
      trace,
    );
  }

  // ── Pass 3: Grid import ───────────────────────────────────────────────

  if (trace) {
    const imports = members
      .filter((m) => (deficit.get(m) ?? 0) > 0)
      .map((m) => ({ member: m, gridImportWh: deficit.get(m)! }));
    trace({ type: 'pass3', imports });
  }

  // ── Compute exports: production not consumed per source ───────────────

  const exports: ExportAllocation[] = [];
  let totalExportWh = 0;

  for (const source of sortedSources) {
    const prod = production.get(source.sourceId) ?? 0;
    let totalUsedForSource = 0;
    for (const member of members) {
      totalUsedForSource += used.get(source.sourceId)!.get(member) ?? 0;
    }
    const exportWh = prod - totalUsedForSource;
    if (exportWh > 0) {
      exports.push({ sourceId: source.sourceId, exportWh });
      totalExportWh += exportWh;
    }
  }

  if (trace) {
    trace({
      type: 'export',
      exports: exports.map((e) => ({
        source: e.sourceId,
        exportWh: e.exportWh,
      })),
    });
  }

  // ── Build member allocations ──────────────────────────────────────────

  const allocations: MemberAllocation[] = [];
  let totalGridImportWh = 0;

  for (const member of members) {
    const memberConsumption = consumption.get(member) ?? 0;
    const gridImportWh = deficit.get(member) ?? 0;
    totalGridImportWh += gridImportWh;

    if (memberConsumption === 0 && gridImportWh === 0) continue;

    const sourceAllocations: SourceAllocation[] = [];
    for (const source of sortedSources) {
      const usedWh = used.get(source.sourceId)!.get(member) ?? 0;
      if (usedWh > 0) {
        sourceAllocations.push({ sourceId: source.sourceId, usedWh });
      }
    }

    allocations.push({
      memberAddress: member,
      consumptionWh: memberConsumption,
      sourceAllocations,
      gridImportWh,
    });
  }

  // ── Verify invariants ─────────────────────────────────────────────────

  const totalConsumption = members.reduce(
    (sum, m) => sum + (consumption.get(m) ?? 0),
    0,
  );
  const totalProduction = sortedSources.reduce(
    (sum, s) => sum + (production.get(s.sourceId) ?? 0),
    0,
  );
  const totalUsedAll = allocations.reduce(
    (sum, a) => sum + a.sourceAllocations.reduce((s2, sa) => s2 + sa.usedWh, 0),
    0,
  );

  const energyBalance = totalConsumption - (totalUsedAll + totalGridImportWh);
  if (energyBalance !== 0) {
    throw new Error(
      `Energy balance violation: consumption(${totalConsumption}) != ` +
        `local_used(${totalUsedAll}) + grid_import(${totalGridImportWh}), ` +
        `off by ${energyBalance} Wh`,
    );
  }

  const productionBalance = totalUsedAll + totalExportWh - totalProduction;
  if (productionBalance !== 0) {
    throw new Error(
      `Production balance violation: local_used(${totalUsedAll}) + ` +
        `export(${totalExportWh}) != production(${totalProduction}), ` +
        `off by ${productionBalance} Wh`,
    );
  }

  return { allocations, exports, totalGridImportWh, totalExportWh };
}

function redistributeSurplus(
  source: SourceInfo,
  pool: number,
  deficit: Map<string, number>,
  sourceUsed: Map<string, number>,
  members: string[],
  allSources: SourceInfo[],
  trace?: TraceFn,
): void {
  let remainingPool = pool;

  const weightSource = pickWeightSource(source, deficit, members, allSources);
  if (!weightSource) return;

  const isFallback = weightSource.sourceId !== source.sourceId;

  trace?.({
    type: 'pass2_source_start',
    source: source.sourceId,
    pool,
    weightSource: weightSource.sourceId,
    isFallback,
  });

  let iteration = 0;
  while (remainingPool > 0) {
    iteration++;
    const eligible = members.filter(
      (m) =>
        (deficit.get(m) ?? 0) > 0 &&
        (weightSource.ownershipBps.get(m) ?? 0) > 0,
    );
    if (eligible.length === 0) break;

    const totalWeight = eligible.reduce(
      (sum, m) => sum + (weightSource.ownershipBps.get(m) ?? 0),
      0,
    );
    if (totalWeight === 0) break;

    let distributed = 0;
    let someoneHitCap = false;
    const poolBefore = remainingPool;

    const eligibleDetails: Array<{
      member: string;
      weight: number;
      alloc: number;
      deficitBefore: number;
      extra: number;
      deficitAfter: number;
      hitCap: boolean;
    }> = [];

    for (const member of eligible) {
      const weight = weightSource.ownershipBps.get(member) ?? 0;
      const alloc = Math.floor((remainingPool * weight) / totalWeight);
      const memberDeficit = deficit.get(member)!;
      const extra = Math.min(alloc, memberDeficit);

      sourceUsed.set(member, (sourceUsed.get(member) ?? 0) + extra);
      deficit.set(member, memberDeficit - extra);
      distributed += extra;

      const hitCap = extra < alloc;
      if (hitCap) someoneHitCap = true;

      eligibleDetails.push({
        member,
        weight,
        alloc,
        deficitBefore: memberDeficit,
        extra,
        deficitAfter: memberDeficit - extra,
        hitCap,
      });
    }

    remainingPool -= distributed;

    trace?.({
      type: 'pass2_iteration',
      source: source.sourceId,
      iteration,
      eligible: eligibleDetails,
      totalWeight,
      poolBefore,
      distributed,
      poolAfter: remainingPool,
    });

    if (!someoneHitCap || distributed === 0) break;
  }

  if (trace) {
    trace({
      type: 'pass2_source_end',
      source: source.sourceId,
      deficits: members
        .filter((m) => (deficit.get(m) ?? 0) > 0)
        .map((m) => ({ member: m, deficit: deficit.get(m)! })),
    });
  }
}

function pickWeightSource(
  primarySource: SourceInfo,
  deficit: Map<string, number>,
  members: string[],
  allSources: SourceInfo[],
): SourceInfo | null {
  const hasEligible = (s: SourceInfo) =>
    members.some(
      (m) => (deficit.get(m) ?? 0) > 0 && (s.ownershipBps.get(m) ?? 0) > 0,
    );

  if (hasEligible(primarySource)) return primarySource;

  for (const fallback of allSources) {
    if (fallback.sourceId === primarySource.sourceId) continue;
    if (hasEligible(fallback)) return fallback;
  }

  return null;
}
