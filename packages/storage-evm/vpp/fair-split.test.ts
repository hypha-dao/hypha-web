import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fairSplit } from './fair-split';
import { buildConsumptionReadings, IMPORT_SOURCE_ID } from './build-readings';
import type {
  FairSplitInput,
  FairSplitResult,
  SourceInfo,
  MemberInfo,
  ConsumptionReading,
  IntervalReading,
  TraceEvent,
} from './types';

// ── Community setup (matches deployed mainnet demo) ─────────────────────────
//
//  Members:
//    HH 1-5 : households with smart meters (device 1-5)
//    Inv 1-2: pure investors (no device, no consumption)
//
//  Production meters:
//    meter 101 = Solar park
//    meter 102 = Battery 1
//    meter 103 = Battery 2
//
//  Ownership:
//    Solar     — HH 1-5: 10% each, Inv 1-2: 25% each
//    Battery 1 — Inv 1: 50%, Inv 2: 50%   (fully investor-owned)
//    Battery 2 — Inv 2: 100%               (fully investor-owned)
//
//  Pricing:
//    Solar: 10 ct/kWh  Bat2: 12 ct/kWh  Bat1: 15 ct/kWh  Import: 30 ct/kWh  Export: 8 ct/kWh

const HH1 = '0xE6Cb7851C53B013506699BB950fFF369dc1Ecd2c';
const HH2 = '0xE0BcaDEb97097EEad449c81F94474063a4E65b27';
const HH3 = '0x12C13F50e686caD891C37Efa957E99AB4240b130';
const HH4 = '0x90E9DA3d4e0de50C0ce1FE143C88c3429d4bF4d2';
const HH5 = '0xFa9325bb0953E179fda917E8881F910837122bA7';
const INV1 = '0x2967eb7Bd1F6954a0ea8Fc34fC50379e01123E16';
const INV2 = '0xA0d6BE505361A862044e1a36b31E2C5C108D474a';

const ALL_MEMBERS = [HH1, HH2, HH3, HH4, HH5, INV1, INV2];

const SOLAR = 'SOLAR';
const BAT1 = 'BATTERY_1';
const BAT2 = 'BATTERY_2';

const PRICE_SOLAR = 10n;
const PRICE_BAT1 = 15n;
const PRICE_BAT2 = 12n;
const PRICE_IMPORT = 30n;
const PRICE_EXPORT = 8n;

const EXPORT_DEVICE_ID = 9999;

const METER_SOLAR = 101;
const METER_BAT1 = 102;
const METER_BAT2 = 103;

function communitySources(): SourceInfo[] {
  return [
    {
      sourceId: SOLAR,
      sourceType: 'SOLAR',
      basePricePerKwh: PRICE_SOLAR,
      ownershipToken: '0xSolarToken',
      ownershipBps: new Map([
        [HH1, 1000],
        [HH2, 1000],
        [HH3, 1000],
        [HH4, 1000],
        [HH5, 1000],
        [INV1, 2500],
        [INV2, 2500],
      ]),
    },
    {
      sourceId: BAT1,
      sourceType: 'BATTERY',
      basePricePerKwh: PRICE_BAT1,
      ownershipToken: '0xBat1Token',
      ownershipBps: new Map([
        [INV1, 5000],
        [INV2, 5000],
      ]),
    },
    {
      sourceId: BAT2,
      sourceType: 'BATTERY',
      basePricePerKwh: PRICE_BAT2,
      ownershipToken: '0xBat2Token',
      ownershipBps: new Map([[INV2, 10000]]),
    },
  ];
}

function communityMembers(): MemberInfo[] {
  return [
    { address: HH1, deviceIds: [1], isActive: true },
    { address: HH2, deviceIds: [2], isActive: true },
    { address: HH3, deviceIds: [3], isActive: true },
    { address: HH4, deviceIds: [4], isActive: true },
    { address: HH5, deviceIds: [5], isActive: true },
    { address: INV1, deviceIds: [], isActive: true },
    { address: INV2, deviceIds: [], isActive: true },
  ];
}

// ── Display helpers ─────────────────────────────────────────────────────────

const NAME: Record<string, string> = {
  [HH1]: 'HH 1',
  [HH2]: 'HH 2',
  [HH3]: 'HH 3',
  [HH4]: 'HH 4',
  [HH5]: 'HH 5',
  [INV1]: 'Inv 1',
  [INV2]: 'Inv 2',
};

const DEVICE_NAME: Record<number, string> = {
  1: 'HH 1',
  2: 'HH 2',
  3: 'HH 3',
  4: 'HH 4',
  5: 'HH 5',
  [EXPORT_DEVICE_ID]: 'Export',
  [METER_SOLAR]: 'Solar',
  [METER_BAT1]: 'Bat 1',
  [METER_BAT2]: 'Bat 2',
};

function n(addr: string): string {
  return NAME[addr] ?? addr.slice(0, 8);
}

function wh(v: number): string {
  if (v === 0) return '0';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
}

function pad(s: string, w: number): string {
  return s.padEnd(w);
}
function rpad(s: string, w: number): string {
  return s.padStart(w);
}

function shortSrc(sid: string): string {
  if (sid === IMPORT_SOURCE_ID) return 'IMPORT';
  return sid.length > 14 ? sid.slice(0, 10) + '...' : sid;
}

// ── Input display: interval_readings from TimescaleDB ───────────────────────

function logIntervalReadings(readings: IntervalReading[]): void {
  console.log('\n    ┌─ INPUT: interval_readings (from TimescaleDB) ─────');
  console.log(
    `    │ ${pad('meter_id', 10)} ${pad('name', 8)} ${rpad(
      'energy_wh',
      10,
    )} ${pad('direction', 12)}`,
  );
  console.log(`    │ ${'─'.repeat(45)}`);
  for (const r of readings) {
    const dn = DEVICE_NAME[r.meter_id] ?? `meter ${r.meter_id}`;
    console.log(
      `    │ ${pad(String(r.meter_id), 10)} ${pad(dn, 8)} ${rpad(
        wh(r.energy_wh),
        10,
      )} ${pad(r.direction, 12)}`,
    );
  }
  const totalCons = readings
    .filter((r) => r.direction === 'consumption')
    .reduce((s, r) => s + r.energy_wh, 0);
  const totalProd = readings
    .filter((r) => r.direction === 'production')
    .reduce((s, r) => s + r.energy_wh, 0);
  console.log(`    │ ${'─'.repeat(45)}`);
  console.log(`    │ Total consumption: ${wh(totalCons)} Wh`);
  console.log(`    │ Total production:  ${wh(totalProd)} Wh`);
  const diff = totalCons - totalProd;
  if (diff > 0)
    console.log(`    │ Shortfall:         ${wh(diff)} Wh → grid import`);
  else if (diff < 0)
    console.log(`    │ Surplus:           ${wh(-diff)} Wh → export`);
  else console.log(`    │ Balanced:          supply = demand`);
  console.log('    └──────────────────────────────────────────────────');
}

// ── Contract output display ─────────────────────────────────────────────────

function logContractReadings(readings: ConsumptionReading[]): void {
  console.log('\n    ┌─ OUTPUT: ConsumptionReading[] → consumeEnergy() ──');
  console.log(
    `    │ ${rpad('#', 3)} ${pad('deviceId', 10)} ${pad('who', 8)} ` +
      `${rpad('quantity', 10)} ${rpad('price', 7)} ${pad('sourceId', 12)} ` +
      `${rpad('charge', 10)}`,
  );
  console.log(`    │ ${'─'.repeat(65)}`);

  let totalCharge = 0n;
  readings.forEach((r, i) => {
    const devName = DEVICE_NAME[Number(r.deviceId)] ?? `dev ${r.deviceId}`;
    const charge = r.quantity * r.pricePerKwh;
    totalCharge += charge;
    const srcLabel = shortSrc(r.sourceId);
    console.log(
      `    │ ${rpad(String(i + 1), 3)} ${pad(String(r.deviceId), 10)} ${pad(
        devName,
        8,
      )} ` +
        `${rpad(String(r.quantity), 10)} ${rpad(
          String(r.pricePerKwh),
          7,
        )} ${pad(srcLabel, 12)} ` +
        `${rpad(String(charge), 10)}`,
    );
  });

  console.log(`    │ ${'─'.repeat(65)}`);
  console.log(
    `    │ ${readings.length} readings, total charge: ${totalCharge}`,
  );
  console.log('    └──────────────────────────────────────────────────');
}

// ── Trace renderer ──────────────────────────────────────────────────────────

function renderTrace(event: TraceEvent): void {
  switch (event.type) {
    case 'pass1_member': {
      const e = event;
      if (e.bps === 0 && e.share === 0) return;
      const tag =
        e.surplus > 0 && e.used === 0
          ? ' (ALL SURPLUS)'
          : e.surplus > 0
          ? ` (surplus ${wh(e.surplus)})`
          : '';
      console.log(
        `    ${pad(n(e.member), 7)} │ ${pad(e.source, 11)} │ ` +
          `${rpad(String(e.bps), 5)} bps × ${rpad(wh(e.production), 5)} = ` +
          `${rpad(wh(e.share), 6)} share │ used ${rpad(wh(e.used), 6)} │ ` +
          `remain ${rpad(wh(e.remainingAfter), 6)}${tag}`,
      );
      break;
    }

    case 'pass1_summary': {
      console.log('\n    ┌─ Pass 1 Summary ─────────────────────────────────');
      console.log('    │ Deficits:');
      for (const d of event.deficits) {
        console.log(
          `    │   ${pad(n(d.member), 7)} ${rpad(wh(d.deficit), 6)} Wh`,
        );
      }
      const totalDef = event.deficits.reduce((s, d) => s + d.deficit, 0);
      console.log(`    │   ${'─'.repeat(20)}`);
      console.log(`    │   ${pad('Total', 7)} ${rpad(wh(totalDef), 6)} Wh`);
      console.log('    │ Surplus pools:');
      for (const sp of event.surplusPools) {
        console.log(`    │   ${pad(sp.source, 11)} ${rpad(wh(sp.pool), 6)} Wh`);
      }
      console.log('    └──────────────────────────────────────────────────');
      break;
    }

    case 'pass2_source_start': {
      const fb = event.isFallback
        ? ` ⚠ FALLBACK → using ${event.weightSource} ownership`
        : '';
      console.log(
        `\n    ┌─ Pass 2: Redistribute ${event.source} surplus ` +
          `(pool = ${wh(event.pool)} Wh)${fb}`,
      );
      break;
    }

    case 'pass2_iteration': {
      const e = event;
      console.log(
        `    │ Iteration ${e.iteration}  (pool = ${wh(e.poolBefore)} Wh, W = ${
          e.totalWeight
        } bps)`,
      );
      console.log(
        `    │   ${pad('Member', 7)} │ ${rpad('Wt', 5)} │ ` +
          `${rpad('Alloc', 6)} │ ${rpad('Deficit', 7)} │ ` +
          `${rpad('Given', 6)} │ ${rpad('Remain', 7)} │ Cap?`,
      );
      console.log(`    │   ${'─'.repeat(60)}`);
      for (const m of e.eligible) {
        console.log(
          `    │   ${pad(n(m.member), 7)} │ ${rpad(String(m.weight), 5)} │ ` +
            `${rpad(wh(m.alloc), 6)} │ ${rpad(wh(m.deficitBefore), 7)} │ ` +
            `${rpad(wh(m.extra), 6)} │ ${rpad(wh(m.deficitAfter), 7)} │ ${
              m.hitCap ? 'YES' : ''
            }`,
        );
      }
      console.log(
        `    │   Distributed: ${wh(e.distributed)} → pool left: ${wh(
          e.poolAfter,
        )} Wh`,
      );
      break;
    }

    case 'pass2_source_end': {
      if (event.deficits.length > 0) {
        console.log('    │ Deficits after:');
        for (const d of event.deficits) {
          console.log(
            `    │   ${pad(n(d.member), 7)} ${rpad(wh(d.deficit), 6)} Wh`,
          );
        }
      } else {
        console.log('    │ All deficits resolved ✓');
      }
      console.log('    └──────────────────────────────────────────────────');
      break;
    }

    case 'pass3': {
      console.log('\n    ┌─ Pass 3: Grid import ─────────────────────────');
      if (event.imports.length > 0) {
        for (const imp of event.imports) {
          console.log(
            `    │   ${pad(n(imp.member), 7)} ${rpad(
              wh(imp.gridImportWh),
              6,
            )} Wh ` +
              `@ ${PRICE_IMPORT} ct/kWh = ${(
                (imp.gridImportWh / 1000) *
                Number(PRICE_IMPORT)
              ).toFixed(1)} ct`,
          );
        }
        const total = event.imports.reduce((s, i) => s + i.gridImportWh, 0);
        console.log(`    │   Total grid: ${wh(total)} Wh`);
      } else {
        console.log('    │   No grid import needed ✓');
      }
      console.log('    └──────────────────────────────────────────────────');
      break;
    }

    case 'export': {
      console.log('\n    ┌─ Export ─────────────────────────────────────────');
      if (event.exports.length > 0) {
        for (const exp of event.exports) {
          const rev = (exp.exportWh / 1000) * Number(PRICE_EXPORT);
          console.log(
            `    │   ${pad(exp.source, 11)} ${rpad(wh(exp.exportWh), 6)} Wh ` +
              `@ ${PRICE_EXPORT} ct/kWh = ${rev.toFixed(1)} ct revenue`,
          );
        }
      } else {
        console.log('    │   No surplus to export ✓');
      }
      console.log('    └──────────────────────────────────────────────────');
      break;
    }
  }
}

// ── Final allocation table ──────────────────────────────────────────────────

function logFinalTable(result: FairSplitResult, input: FairSplitInput): void {
  const sorted = [...input.sources].sort((a, b) =>
    a.basePricePerKwh < b.basePricePerKwh ? -1 : 1,
  );
  const sids = sorted.map((s) => s.sourceId);

  console.log('\n    ┌─ Final Allocation ────────────────────────────────');
  const hdr =
    `    │ ${pad('Member', 7)} │ ` +
    sids.map((id) => rpad(id, 11)).join(' │ ') +
    ` │ ${rpad('Grid', 7)} │ ${rpad('Total', 7)}`;
  console.log(hdr);
  console.log(`    │ ${'─'.repeat(hdr.length - 6)}`);

  for (const m of input.members) {
    const a = result.allocations.find((x) => x.memberAddress === m);
    const cons = input.consumption.get(m) ?? 0;
    if (!a && cons === 0) continue;
    if (!a) continue;
    const cols = sids
      .map((sid) => {
        const sa = a.sourceAllocations.find((x) => x.sourceId === sid);
        return rpad(sa ? wh(sa.usedWh) : '—', 11);
      })
      .join(' │ ');
    const gridCol = rpad(a.gridImportWh > 0 ? wh(a.gridImportWh) : '—', 7);
    const totalWh =
      a.sourceAllocations.reduce((s, sa) => s + sa.usedWh, 0) + a.gridImportWh;
    console.log(
      `    │ ${pad(n(a.memberAddress), 7)} │ ${cols} │ ${gridCol} │ ${rpad(
        wh(totalWh),
        7,
      )}`,
    );
  }
  console.log('    └──────────────────────────────────────────────────');

  const totalCons = input.members.reduce(
    (s, m) => s + (input.consumption.get(m) ?? 0),
    0,
  );
  const totalUsed = result.allocations.reduce(
    (s, a) => s + a.sourceAllocations.reduce((s2, sa) => s2 + sa.usedWh, 0),
    0,
  );
  const totalProd = input.sources.reduce(
    (s, src) => s + (input.production.get(src.sourceId) ?? 0),
    0,
  );
  console.log(
    `\n    Energy:     ${totalCons} = ${totalUsed} local + ${result.totalGridImportWh} grid  ✓`,
  );
  console.log(
    `    Production: ${totalProd} = ${totalUsed} used + ${result.totalExportWh} export  ✓`,
  );
}

// ── Scenario builder helpers ────────────────────────────────────────────────

const INTERVAL = '2026-04-10T12:00:00Z';
const COMMUNITY = 1;

function makeIntervalReadings(
  hhDemands: number[],
  prodMap: Map<string, number>,
): IntervalReading[] {
  const meterForSource: Record<string, number> = {
    [SOLAR]: METER_SOLAR,
    [BAT1]: METER_BAT1,
    [BAT2]: METER_BAT2,
  };

  const readings: IntervalReading[] = [];

  hhDemands.forEach((demand, i) => {
    if (demand > 0) {
      readings.push({
        interval_start: INTERVAL,
        meter_id: i + 1,
        community_id: COMMUNITY,
        energy_wh: demand,
        direction: 'consumption',
      });
    }
  });

  for (const [sourceId, energy] of prodMap) {
    if (energy > 0) {
      readings.push({
        interval_start: INTERVAL,
        meter_id: meterForSource[sourceId],
        community_id: COMMUNITY,
        energy_wh: energy,
        direction: 'production',
      });
    }
  }

  return readings;
}

function runScenario(input: FairSplitInput, readings: IntervalReading[]) {
  logIntervalReadings(readings);

  console.log('\n  ── PASS 1: Ownership allocation ──');
  console.log('  share = ownershipBps × production / 10000\n');

  const result = fairSplit(input, renderTrace);
  logFinalTable(result, input);

  const contractReadings = buildConsumptionReadings(
    result,
    input.sources,
    communityMembers(),
    EXPORT_DEVICE_ID,
    input.gridImportPrice,
    input.gridExportPrice,
  );
  logContractReadings(contractReadings);

  return { result, contractReadings };
}

// ── Result helpers ──────────────────────────────────────────────────────────

function getAlloc(r: FairSplitResult, m: string) {
  return r.allocations.find((a) => a.memberAddress === m);
}

function srcWh(r: FairSplitResult, m: string, sid: string): number {
  return (
    getAlloc(r, m)?.sourceAllocations.find((s) => s.sourceId === sid)?.usedWh ??
    0
  );
}

function gridWh(r: FairSplitResult, m: string): number {
  return getAlloc(r, m)?.gridImportWh ?? 0;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('fairSplit — mainnet demo community', () => {
  describe('Scenario 1 — Import (80 kWh demand, 78 kWh local → 2 kWh grid)', () => {
    let result: FairSplitResult;
    let contractReadings: ConsumptionReading[];

    it('runs the full pipeline', () => {
      const hhDemands = [20000, 18000, 15000, 12000, 15000];
      const prodMap = new Map([
        [SOLAR, 60000],
        [BAT1, 10000],
        [BAT2, 8000],
      ]);
      const readings = makeIntervalReadings(hhDemands, prodMap);

      const input: FairSplitInput = {
        members: ALL_MEMBERS,
        consumption: new Map([
          [HH1, 20000],
          [HH2, 18000],
          [HH3, 15000],
          [HH4, 12000],
          [HH5, 15000],
        ]),
        production: prodMap,
        sources: communitySources(),
        gridImportPrice: PRICE_IMPORT,
        gridExportPrice: PRICE_EXPORT,
      };

      console.log('\n' + '═'.repeat(72));
      console.log('  SCENARIO 1 — Import (battery fallback + multi-iteration)');
      console.log('  Solar 60k, Bat2 8k, Bat1 10k = 78k Wh | Demand 80k Wh');
      console.log('═'.repeat(72));

      ({ result, contractReadings } = runScenario(input, readings));
    });

    it('HH 1: solar 12k, bat2 2k, bat1 4k, grid 2k', () => {
      assert.equal(srcWh(result, HH1, SOLAR), 12000);
      assert.equal(srcWh(result, HH1, BAT2), 2000);
      assert.equal(srcWh(result, HH1, BAT1), 4000);
      assert.equal(gridWh(result, HH1), 2000);
    });

    it('HH 2: solar 12k, bat2 2k, bat1 4k, grid 0', () => {
      assert.equal(srcWh(result, HH2, SOLAR), 12000);
      assert.equal(srcWh(result, HH2, BAT2), 2000);
      assert.equal(srcWh(result, HH2, BAT1), 4000);
      assert.equal(gridWh(result, HH2), 0);
    });

    it('HH 3: solar 12k, bat2 2k, bat1 1k', () => {
      assert.equal(srcWh(result, HH3, SOLAR), 12000);
      assert.equal(srcWh(result, HH3, BAT2), 2000);
      assert.equal(srcWh(result, HH3, BAT1), 1000);
      assert.equal(gridWh(result, HH3), 0);
    });

    it('HH 4: solar 12k only', () => {
      assert.equal(srcWh(result, HH4, SOLAR), 12000);
      assert.equal(srcWh(result, HH4, BAT2), 0);
      assert.equal(srcWh(result, HH4, BAT1), 0);
    });

    it('HH 5: solar 12k, bat2 2k, bat1 1k', () => {
      assert.equal(srcWh(result, HH5, SOLAR), 12000);
      assert.equal(srcWh(result, HH5, BAT2), 2000);
      assert.equal(srcWh(result, HH5, BAT1), 1000);
    });

    it('grid import = 2 kWh, no exports', () => {
      assert.equal(result.totalGridImportWh, 2000);
      assert.equal(result.totalExportWh, 0);
    });

    it('contract receives correct number of readings', () => {
      // 5 HH × (solar + bat2 + bat1) - HH4 has no bat2/bat1 = 5+4+4 = 13
      // + 1 grid import for HH1 = 14 readings
      assert.equal(contractReadings.length, 14);
    });

    it('contract readings sum matches total consumption', () => {
      const totalQty = contractReadings.reduce((s, r) => s + r.quantity, 0n);
      assert.equal(totalQty, 80000n);
    });
  });

  describe('Scenario 2 — Export (40 kWh demand, 100 kWh solar → 60 kWh exported)', () => {
    let result: FairSplitResult;
    let contractReadings: ConsumptionReading[];

    it('runs the full pipeline', () => {
      const hhDemands = [10000, 8000, 5000, 7000, 10000];
      const prodMap = new Map([[SOLAR, 100000]]);
      const readings = makeIntervalReadings(hhDemands, prodMap);

      const input: FairSplitInput = {
        members: ALL_MEMBERS,
        consumption: new Map([
          [HH1, 10000],
          [HH2, 8000],
          [HH3, 5000],
          [HH4, 7000],
          [HH5, 10000],
        ]),
        production: prodMap,
        sources: communitySources(),
        gridImportPrice: PRICE_IMPORT,
        gridExportPrice: PRICE_EXPORT,
      };

      console.log('\n' + '═'.repeat(72));
      console.log('  SCENARIO 2 — Export (sunny afternoon, low demand)');
      console.log('  Solar 100k Wh | Demand 40k Wh → 60k Wh surplus');
      console.log('═'.repeat(72));

      ({ result, contractReadings } = runScenario(input, readings));
    });

    it('each HH uses only solar', () => {
      assert.equal(srcWh(result, HH1, SOLAR), 10000);
      assert.equal(srcWh(result, HH2, SOLAR), 8000);
      assert.equal(srcWh(result, HH3, SOLAR), 5000);
      assert.equal(srcWh(result, HH4, SOLAR), 7000);
      assert.equal(srcWh(result, HH5, SOLAR), 10000);
    });

    it('60 kWh solar exported', () => {
      assert.equal(result.totalExportWh, 60000);
    });

    it('contract has export reading with device 9999', () => {
      const exportR = contractReadings.find(
        (r) => r.deviceId === BigInt(EXPORT_DEVICE_ID),
      );
      assert.ok(exportR, 'export reading missing');
      assert.equal(exportR!.quantity, 60000n);
      assert.equal(exportR!.pricePerKwh, PRICE_EXPORT);
    });

    it('contract readings: 5 consumption + 1 export = 6', () => {
      assert.equal(contractReadings.length, 6);
    });
  });

  describe('Scenario 3 — Balanced (70 kWh = 70 kWh, no grid, no export)', () => {
    let result: FairSplitResult;
    let contractReadings: ConsumptionReading[];

    it('runs the full pipeline', () => {
      const hhDemands = [15000, 15000, 10000, 15000, 15000];
      const prodMap = new Map([
        [SOLAR, 50000],
        [BAT1, 15000],
        [BAT2, 5000],
      ]);
      const readings = makeIntervalReadings(hhDemands, prodMap);

      const input: FairSplitInput = {
        members: ALL_MEMBERS,
        consumption: new Map([
          [HH1, 15000],
          [HH2, 15000],
          [HH3, 10000],
          [HH4, 15000],
          [HH5, 15000],
        ]),
        production: prodMap,
        sources: communitySources(),
        gridImportPrice: PRICE_IMPORT,
        gridExportPrice: PRICE_EXPORT,
      };

      console.log('\n' + '═'.repeat(72));
      console.log('  SCENARIO 3 — Balanced (perfect self-sufficiency)');
      console.log('  Solar 50k, Bat2 5k, Bat1 15k = 70k Wh | Demand 70k Wh');
      console.log('═'.repeat(72));

      ({ result, contractReadings } = runScenario(input, readings));
    });

    it('no grid import and no exports', () => {
      assert.equal(result.totalGridImportWh, 0);
      assert.equal(result.totalExportWh, 0);
    });

    it('no IMPORT or export readings in contract output', () => {
      const hasImport = contractReadings.some(
        (r) => r.sourceId === IMPORT_SOURCE_ID,
      );
      const hasExport = contractReadings.some(
        (r) => r.deviceId === BigInt(EXPORT_DEVICE_ID),
      );
      assert.equal(hasImport, false);
      assert.equal(hasExport, false);
    });

    it('all production consumed', () => {
      const totalUsed = result.allocations.reduce(
        (s, a) => s + a.sourceAllocations.reduce((s2, sa) => s2 + sa.usedWh, 0),
        0,
      );
      assert.equal(totalUsed, 70000);
    });
  });

  describe('Scenario 4 — Heavy import (125 kWh demand, 20 kWh solar → 105 kWh grid)', () => {
    let result: FairSplitResult;
    let contractReadings: ConsumptionReading[];

    it('runs the full pipeline', () => {
      const hhDemands = [25000, 25000, 25000, 25000, 25000];
      const prodMap = new Map([[SOLAR, 20000]]);
      const readings = makeIntervalReadings(hhDemands, prodMap);

      const input: FairSplitInput = {
        members: ALL_MEMBERS,
        consumption: new Map([
          [HH1, 25000],
          [HH2, 25000],
          [HH3, 25000],
          [HH4, 25000],
          [HH5, 25000],
        ]),
        production: prodMap,
        sources: communitySources(),
        gridImportPrice: PRICE_IMPORT,
        gridExportPrice: PRICE_EXPORT,
      };

      console.log('\n' + '═'.repeat(72));
      console.log('  SCENARIO 4 — Heavy import (cloudy day, equal demand)');
      console.log('  Solar 20k Wh | Demand 125k Wh → 105k grid');
      console.log('═'.repeat(72));

      ({ result, contractReadings } = runScenario(input, readings));
    });

    it('each HH: 4 kWh solar + 21 kWh grid (symmetric)', () => {
      for (const hh of [HH1, HH2, HH3, HH4, HH5]) {
        assert.equal(srcWh(result, hh, SOLAR), 4000);
        assert.equal(gridWh(result, hh), 21000);
      }
    });

    it('contract has 5 solar + 5 import = 10 readings', () => {
      assert.equal(contractReadings.length, 10);
    });

    it('contract grid readings all use IMPORT_SOURCE_ID', () => {
      const importReadings = contractReadings.filter(
        (r) => r.sourceId === IMPORT_SOURCE_ID,
      );
      assert.equal(importReadings.length, 5);
      for (const r of importReadings) {
        assert.equal(r.quantity, 21000n);
        assert.equal(r.pricePerKwh, PRICE_IMPORT);
      }
    });
  });
});
