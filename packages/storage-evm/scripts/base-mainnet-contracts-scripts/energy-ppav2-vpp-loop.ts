/**
 * EnergyPPAv2 — VPP Fair-Split Settlement Loop
 *
 * Unified script that:
 *   1. Reads deployed community state from JSON
 *   2. Generates random 15-min interval meter data
 *   3. Runs the 3-pass fair-split algorithm (with full trace logging)
 *   4. Submits the resulting ConsumptionReading[] to the contract
 *   5. Prints on-chain state before and after
 *   6. Loops continuously (configurable interval)
 *
 * Environment variables:
 *   ENERGY_DEMO_COMMAND     reset | once | loop (default: loop)
 *   ENERGY_DEMO_LOOP_MS     ms between batches (default: 45000)
 *   ENERGY_PPAV2_STATE_FILE path to state JSON (default: energy-ppav2-demo-state.json)
 *
 * Usage:
 *   ENERGY_DEMO_COMMAND=reset npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-vpp-loop.ts --network base-mainnet
 *   ENERGY_DEMO_COMMAND=once  npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-vpp-loop.ts --network base-mainnet
 *   ENERGY_DEMO_COMMAND=loop  npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-vpp-loop.ts --network base-mainnet
 */

import * as fs from 'fs';
import * as path from 'path';

import { keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'hardhat';

import dotenv from 'dotenv';

import { fairSplit } from '../../vpp/fair-split';
import {
  buildConsumptionReadings,
  IMPORT_SOURCE_ID,
} from '../../vpp/build-readings';
import type {
  FairSplitInput,
  FairSplitResult,
  SourceInfo,
  MemberInfo,
  TraceEvent,
  ConsumptionReading as VppReading,
} from '../../vpp/types';

dotenv.config();

// ── Constants ──────────────────────────────────────────────────────────────

const SOLAR_SOURCE_ID = keccak256(toUtf8Bytes('DEMO_SOLAR_V5'));
const BATTERY_1_SOURCE_ID = keccak256(toUtf8Bytes('DEMO_BATTERY_1_V5'));
const BATTERY_2_SOURCE_ID = keccak256(toUtf8Bytes('DEMO_BATTERY_2_V5'));

const HH_DEVICE_IDS = [1n, 2n, 3n, 4n, 5n] as const;
const EXPORT_DEVICE_ID = 9999n;

// Prices are in euro cents per kWh (integer).
// The contract computes: charge = quantity_kWh × price_ct = euro cents.
// 1 internal credit = 1 euro cent.
// Stablecoin conversion: 1 credit × 10,000 = stablecoin base units.
// For EURC (6 decimals): 10,000 / 1,000,000 = €0.01 = 1 cent.
const PRICE_SOLAR = 10n; // 10 ct/kWh = €0.10/kWh
const PRICE_BAT_1 = 15n; // 15 ct/kWh = €0.15/kWh
const PRICE_BAT_2 = 12n; // 12 ct/kWh = €0.12/kWh
const PRICE_IMPORT = 30n; // 30 ct/kWh = €0.30/kWh
const PRICE_EXPORT = 8n; //  8 ct/kWh = €0.08/kWh

// VPP algorithm works in Wh; contract expects kWh.
// This divisor converts Wh → kWh before submission.
const QUANTITY_SCALE = 1000;

// ── Types ──────────────────────────────────────────────────────────────────

interface DemoState {
  networkChainId: number;
  factory: string;
  communityId: string;
  ppaProxy: string;
  energyToken: string;
  solarToken: string;
  battery1Token: string;
  battery2Token: string;
  solarSourceId: string;
  battery1SourceId: string;
  battery2SourceId: string;
  households: string[];
  investors: string[];
  deployedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

function stateFilePath(): string {
  const custom = getEnv('ENERGY_PPAV2_STATE_FILE');
  if (custom)
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  return path.join(__dirname, 'energy-ppav2-demo-state.json');
}

function loadState(): DemoState {
  const p = stateFilePath();
  if (!fs.existsSync(p)) throw new Error(`State file not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as DemoState;
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Formatting ─────────────────────────────────────────────────────────────

const SEP = '═'.repeat(78);
const THIN = '─'.repeat(78);

function pad(s: string, w: number): string {
  return s.padEnd(w);
}
function rpad(s: string, w: number): string {
  return s.padStart(w);
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function memberLabel(addr: string, state: DemoState): string {
  const hi = state.households.indexOf(addr);
  if (hi >= 0) return `HH ${hi + 1}`;
  const ii = state.investors.indexOf(addr);
  if (ii >= 0) return `Inv ${ii + 1}`;
  return shortAddr(addr);
}

function wh(v: number): string {
  if (v === 0) return '0';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
}

/**
 * Format an internal credit balance (integer cents) as a euro string.
 * e.g. -48429 → "−€484.29", 250272 → "€2,502.72"
 */
function euroStr(credits: number | bigint): string {
  const n = Number(credits);
  const abs = Math.abs(n);
  const euros = abs / 100;
  const formatted = euros.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n < 0) return `−€${formatted}`;
  return `€${formatted}`;
}

function srcName(sid: string): string {
  if (sid === SOLAR_SOURCE_ID) return 'SOLAR';
  if (sid === BATTERY_1_SOURCE_ID) return 'BAT 1';
  if (sid === BATTERY_2_SOURCE_ID) return 'BAT 2';
  if (sid === IMPORT_SOURCE_ID) return 'IMPORT';
  return sid.slice(0, 10) + '…';
}

// ── Build VPP input from state ─────────────────────────────────────────────

function buildSources(state: DemoState): SourceInfo[] {
  return [
    {
      sourceId: state.solarSourceId,
      sourceType: 'SOLAR',
      basePricePerKwh: PRICE_SOLAR,
      ownershipToken: state.solarToken,
      ownershipBps: new Map([
        ...state.households.map((a) => [a, 1000] as [string, number]),
        [state.investors[0], 2500],
        [state.investors[1], 2500],
      ]),
    },
    {
      sourceId: state.battery1SourceId,
      sourceType: 'BATTERY',
      basePricePerKwh: PRICE_BAT_1,
      ownershipToken: state.battery1Token,
      ownershipBps: new Map([
        [state.investors[0], 5000],
        [state.investors[1], 5000],
      ]),
    },
    {
      sourceId: state.battery2SourceId,
      sourceType: 'BATTERY',
      basePricePerKwh: PRICE_BAT_2,
      ownershipToken: state.battery2Token,
      ownershipBps: new Map([[state.investors[1], 10000]]),
    },
  ];
}

function buildMembers(state: DemoState): MemberInfo[] {
  return [
    ...state.households.map((a, i) => ({
      address: a,
      deviceIds: [Number(HH_DEVICE_IDS[i])],
      isActive: true,
    })),
    ...state.investors.map((a) => ({
      address: a,
      deviceIds: [] as number[],
      isActive: true,
    })),
  ];
}

// ── Scenario generation ────────────────────────────────────────────────────

interface ScenarioData {
  label: string;
  solarWh: number;
  bat1Wh: number;
  bat2Wh: number;
  hhDemands: number[];
}

function generateScenario(batchNum: number): ScenarioData {
  const pattern = batchNum % 4;

  switch (pattern) {
    case 0: {
      const solarWh = rand(50, 80) * 1000;
      const bat1Wh = rand(5, 20) * 1000;
      const bat2Wh = rand(3, 12) * 1000;
      const hhDemands = Array.from({ length: 5 }, () => rand(12, 28) * 1000);
      return {
        label: 'Mixed (import likely)',
        solarWh,
        bat1Wh,
        bat2Wh,
        hhDemands,
      };
    }
    case 1: {
      const solarWh = rand(80, 120) * 1000;
      const hhDemands = Array.from({ length: 5 }, () => rand(5, 15) * 1000);
      return {
        label: 'Sunny export',
        solarWh,
        bat1Wh: 0,
        bat2Wh: 0,
        hhDemands,
      };
    }
    case 2: {
      const solarWh = rand(40, 60) * 1000;
      const bat1Wh = rand(10, 25) * 1000;
      const bat2Wh = rand(5, 15) * 1000;
      const totalLocal = solarWh + bat1Wh + bat2Wh;
      const perHH = Math.floor(totalLocal / 5 / 1000) * 1000;
      const hhDemands = Array.from(
        { length: 5 },
        () => perHH + rand(-1, 1) * 1000,
      );
      return { label: 'Near-balanced', solarWh, bat1Wh, bat2Wh, hhDemands };
    }
    case 3: {
      const solarWh = rand(10, 25) * 1000;
      const hhDemands = Array.from({ length: 5 }, () => rand(18, 30) * 1000);
      return {
        label: 'Cloudy heavy import',
        solarWh,
        bat1Wh: 0,
        bat2Wh: 0,
        hhDemands,
      };
    }
    default:
      throw new Error('unreachable');
  }
}

// ── Trace renderer ─────────────────────────────────────────────────────────

function createTraceRenderer(state: DemoState): (event: TraceEvent) => void {
  const ml = (addr: string) => memberLabel(addr, state);
  const sn = srcName;

  return (event: TraceEvent) => {
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
          `    ${pad(ml(e.member), 7)} │ ${pad(sn(e.source), 8)} │ ` +
            `${rpad(String(e.bps), 5)} bps × ${rpad(wh(e.production), 6)} = ` +
            `${rpad(wh(e.share), 6)} share │ used ${rpad(wh(e.used), 6)} │ ` +
            `remain ${rpad(wh(e.remainingAfter), 6)}${tag}`,
        );
        break;
      }

      case 'pass1_summary': {
        console.log(
          '\n    ┌─ Pass 1 Summary ─────────────────────────────────────',
        );
        console.log('    │ Deficits:');
        for (const d of event.deficits)
          console.log(
            `    │   ${pad(ml(d.member), 7)} ${rpad(wh(d.deficit), 6)} Wh`,
          );
        const totalDef = event.deficits.reduce((s, d) => s + d.deficit, 0);
        console.log(`    │   ${'─'.repeat(20)}`);
        console.log(`    │   ${pad('Total', 7)} ${rpad(wh(totalDef), 6)} Wh`);
        console.log('    │ Surplus pools:');
        for (const sp of event.surplusPools)
          console.log(
            `    │   ${pad(sn(sp.source), 8)} ${rpad(wh(sp.pool), 6)} Wh`,
          );
        console.log(
          '    └────────────────────────────────────────────────────────',
        );
        break;
      }

      case 'pass2_source_start': {
        const fb = event.isFallback
          ? ` ⚠ FALLBACK → ${sn(event.weightSource)} ownership`
          : '';
        console.log(
          `\n    ┌─ Pass 2: Redistribute ${sn(event.source)} ` +
            `(pool = ${wh(event.pool)} Wh)${fb}`,
        );
        break;
      }

      case 'pass2_iteration': {
        const e = event;
        console.log(
          `    │ Iter ${e.iteration}  (pool = ${wh(e.poolBefore)}, W = ${
            e.totalWeight
          } bps)`,
        );
        console.log(
          `    │   ${pad('Member', 7)} │ ${rpad('Wt', 5)} │ ` +
            `${rpad('Alloc', 6)} │ ${rpad('Deficit', 7)} │ ` +
            `${rpad('Given', 6)} │ ${rpad('Remain', 7)} │ Cap`,
        );
        console.log(`    │   ${'─'.repeat(58)}`);
        for (const m of e.eligible)
          console.log(
            `    │   ${pad(ml(m.member), 7)} │ ${rpad(
              String(m.weight),
              5,
            )} │ ` +
              `${rpad(wh(m.alloc), 6)} │ ${rpad(wh(m.deficitBefore), 7)} │ ` +
              `${rpad(wh(m.extra), 6)} │ ${rpad(wh(m.deficitAfter), 7)} │ ${
                m.hitCap ? 'YES' : ''
              }`,
          );
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
          for (const d of event.deficits)
            console.log(
              `    │   ${pad(ml(d.member), 7)} ${rpad(wh(d.deficit), 6)} Wh`,
            );
        } else {
          console.log('    │ All deficits resolved ✓');
        }
        console.log(
          '    └────────────────────────────────────────────────────────',
        );
        break;
      }

      case 'pass3': {
        console.log(
          '\n    ┌─ Pass 3: Grid import ──────────────────────────────',
        );
        if (event.imports.length > 0) {
          for (const imp of event.imports) {
            const costCt = (imp.gridImportWh / 1000) * Number(PRICE_IMPORT);
            console.log(
              `    │   ${pad(ml(imp.member), 7)} ${rpad(
                wh(imp.gridImportWh),
                6,
              )} Wh ` +
                `@ ${PRICE_IMPORT} ct/kWh = ${costCt.toFixed(1)} ct (${euroStr(
                  Math.round(costCt),
                )})`,
            );
          }
          const total = event.imports.reduce((s, i) => s + i.gridImportWh, 0);
          const totalCostCt = (total / 1000) * Number(PRICE_IMPORT);
          console.log(
            `    │   Total grid: ${wh(total)} Wh = ${totalCostCt.toFixed(
              1,
            )} ct (${euroStr(Math.round(totalCostCt))})`,
          );
        } else {
          console.log('    │   No grid import needed ✓');
        }
        console.log(
          '    └────────────────────────────────────────────────────────',
        );
        break;
      }

      case 'export': {
        console.log(
          '\n    ┌─ Export ────────────────────────────────────────────',
        );
        if (event.exports.length > 0) {
          for (const exp of event.exports) {
            const revCt = (exp.exportWh / 1000) * Number(PRICE_EXPORT);
            console.log(
              `    │   ${pad(sn(exp.source), 8)} ${rpad(
                wh(exp.exportWh),
                6,
              )} Wh ` +
                `@ ${PRICE_EXPORT} ct/kWh = ${revCt.toFixed(1)} ct (${euroStr(
                  Math.round(revCt),
                )}) revenue`,
            );
          }
        } else {
          console.log('    │   No surplus to export ✓');
        }
        console.log(
          '    └────────────────────────────────────────────────────────',
        );
        break;
      }
    }
  };
}

// ── On-chain state display ─────────────────────────────────────────────────

async function printOnChainState(
  ppa: any,
  state: DemoState,
  heading: string,
): Promise<void> {
  console.log(`\n  ${THIN}`);
  console.log(`  ${heading}`);
  console.log(`  ${THIN}`);

  console.log(
    `    ${pad('Member', 7)} ${pad('Address', 13)} ${rpad('Solar', 7)} ` +
      `${rpad('Bat1', 7)} ${rpad('Bat2', 7)} ${rpad('Credit', 10)}  ${pad(
        'Euro',
        12,
      )}`,
  );
  console.log(`    ${'-'.repeat(72)}`);

  const all = [
    ...state.households.map((a, i) => ({ label: `HH ${i + 1}`, address: a })),
    ...state.investors.map((a, i) => ({ label: `Inv ${i + 1}`, address: a })),
  ];

  for (const { label, address } of all) {
    const sBps = Number(
      await ppa.getSourceOwnershipBps(SOLAR_SOURCE_ID, address),
    );
    const b1Bps = Number(
      await ppa.getSourceOwnershipBps(BATTERY_1_SOURCE_ID, address),
    );
    const b2Bps = Number(
      await ppa.getSourceOwnershipBps(BATTERY_2_SOURCE_ID, address),
    );
    const credit = await ppa.getEnergyCreditBalance(address);
    const creditNum = Number(credit);
    console.log(
      `    ${pad(label, 7)} ${pad(shortAddr(address), 13)} ${rpad(
        `${sBps / 100}%`,
        7,
      )} ` +
        `${rpad(`${b1Bps / 100}%`, 7)} ${rpad(`${b2Bps / 100}%`, 7)} ${rpad(
          credit.toString(),
          10,
        )}  ${pad(euroStr(creditNum), 12)}`,
    );
  }

  const commAddr: string = await ppa.getCommunityAddress();
  const aggrAddr: string = await ppa.getAggregatorAddress();
  if (commAddr !== ethers.ZeroAddress) {
    const commCredit = await ppa.getEnergyCreditBalance(commAddr);
    console.log(
      `    ${pad('Comm', 7)} ${pad(shortAddr(commAddr), 13)} ${rpad('', 7)} ` +
        `${rpad('', 7)} ${rpad('', 7)} ${rpad(
          commCredit.toString(),
          10,
        )}  ${pad(euroStr(Number(commCredit)), 12)}`,
    );
  }
  if (aggrAddr !== ethers.ZeroAddress && aggrAddr !== commAddr) {
    const aggrCredit = await ppa.getEnergyCreditBalance(aggrAddr);
    console.log(
      `    ${pad('Aggr', 7)} ${pad(shortAddr(aggrAddr), 13)} ${rpad('', 7)} ` +
        `${rpad('', 7)} ${rpad('', 7)} ${rpad(
          aggrCredit.toString(),
          10,
        )}  ${pad(euroStr(Number(aggrCredit)), 12)}`,
    );
  }

  // The contract's gridBalance: positive = grid owes community, negative = community owes grid.
  // Zero-sum formula uses −gridBalance. We display −gridBalance so all rows sum to zero.
  const gridRaw: bigint = await ppa.getGridBalance();
  const gridDisplay = -gridRaw;
  const settled: bigint = await ppa.getSettledBalance();
  const gridNote =
    gridRaw > 0n
      ? '(grid owes community)'
      : gridRaw < 0n
      ? '(community owes grid)'
      : '';
  console.log(
    `    ${pad('Grid', 7)} ${pad('', 13)} ${rpad('', 7)} ` +
      `${rpad('', 7)} ${rpad('', 7)} ${rpad(gridDisplay.toString(), 10)}  ${pad(
        euroStr(Number(gridDisplay)),
        12,
      )}  ${gridNote}`,
  );
  console.log(
    `    ${pad('Settld', 7)} ${pad('', 13)} ${rpad('', 7)} ` +
      `${rpad('', 7)} ${rpad('', 7)} ${rpad(settled.toString(), 10)}  ${pad(
        euroStr(Number(settled)),
        12,
      )}`,
  );

  const [ok, sum] = await ppa.verifyZeroSum();
  console.log();
  console.log(
    `    Zero-sum check : ${
      ok ? 'PASS ✓' : 'FAIL ✗'
    }  (sum = ${sum.toString()})`,
  );
}

// ── Contract readings display ──────────────────────────────────────────────

function printContractReadings(
  readings: Array<{
    deviceId: bigint;
    quantity: bigint;
    pricePerKwh: bigint;
    sourceId: string;
  }>,
  state: DemoState,
): void {
  console.log(
    '\n    ┌─ ConsumptionReading[] → consumeEnergy() ────────────────────────',
  );
  console.log(
    `    │ ${rpad('#', 3)} ${pad('dev', 6)} ${pad('who', 7)} ` +
      `${rpad('qty(kWh)', 9)} ${rpad('ct/kWh', 7)} ${pad('source', 8)} ` +
      `${rpad('charge(ct)', 11)} ${rpad('euro', 10)}`,
  );
  console.log(`    │ ${'─'.repeat(68)}`);

  let totalCharge = 0n;
  readings.forEach((r, i) => {
    const devNum = Number(r.deviceId);
    const devLabel =
      devNum === Number(EXPORT_DEVICE_ID)
        ? 'Export'
        : devNum >= 1 && devNum <= 5
        ? `HH ${devNum}`
        : `${devNum}`;
    const charge = r.quantity * r.pricePerKwh;
    totalCharge += charge;
    console.log(
      `    │ ${rpad(String(i + 1), 3)} ${pad(String(r.deviceId), 6)} ${pad(
        devLabel,
        7,
      )} ` +
        `${rpad(r.quantity.toString(), 9)} ${rpad(
          r.pricePerKwh.toString(),
          7,
        )} ` +
        `${pad(srcName(r.sourceId), 8)} ${rpad(charge.toString(), 11)} ${rpad(
          euroStr(Number(charge)),
          10,
        )}`,
    );
  });

  console.log(`    │ ${'─'.repeat(68)}`);
  console.log(
    `    │ ${
      readings.length
    } readings, total charge: ${totalCharge} ct = ${euroStr(
      Number(totalCharge),
    )}`,
  );
  console.log(
    '    └──────────────────────────────────────────────────────────────────',
  );
}

// ── Final allocation table ─────────────────────────────────────────────────

function printFinalAllocation(
  result: FairSplitResult,
  input: FairSplitInput,
  state: DemoState,
): void {
  const sorted = [...input.sources].sort((a, b) =>
    a.basePricePerKwh < b.basePricePerKwh ? -1 : 1,
  );
  const sids = sorted.map((s) => s.sourceId);

  console.log(
    '\n    ┌─ Final Allocation ─────────────────────────────────────',
  );
  const hdr =
    `    │ ${pad('Member', 7)} │ ` +
    sids.map((id) => rpad(srcName(id), 8)).join(' │ ') +
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
        return rpad(sa ? wh(sa.usedWh) : '—', 8);
      })
      .join(' │ ');
    const gridCol = rpad(a.gridImportWh > 0 ? wh(a.gridImportWh) : '—', 7);
    const totalWh =
      a.sourceAllocations.reduce((s, sa) => s + sa.usedWh, 0) + a.gridImportWh;
    console.log(
      `    │ ${pad(
        memberLabel(a.memberAddress, state),
        7,
      )} │ ${cols} │ ${gridCol} │ ${rpad(wh(totalWh), 7)}`,
    );
  }
  console.log('    └────────────────────────────────────────────────────────');

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

// ── Core batch: VPP + on-chain ─────────────────────────────────────────────

async function runBatch(
  ppa: any,
  state: DemoState,
  batchNum: number,
): Promise<void> {
  const scenario = generateScenario(batchNum);
  const sources = buildSources(state);
  const memberInfos = buildMembers(state);
  const allAddrs = [...state.households, ...state.investors];

  // ── Header ──

  console.log(`\n${SEP}`);
  console.log(
    `  BATCH #${batchNum}  │  ${
      scenario.label
    }  │  ${new Date().toISOString()}`,
  );
  console.log(SEP);

  // ── On-chain state BEFORE ──

  await printOnChainState(ppa, state, 'ON-CHAIN STATE BEFORE');

  // ── Input: simulated interval readings ──

  const totalSupply = scenario.solarWh + scenario.bat1Wh + scenario.bat2Wh;
  const totalDemand = scenario.hhDemands.reduce((s, d) => s + d, 0);

  console.log(`\n  ${'─'.repeat(74)}`);
  console.log('  INTERVAL METER DATA (simulated 15-min readings)');
  console.log(`  ${'─'.repeat(74)}`);
  console.log('  Production:');
  if (scenario.solarWh > 0)
    console.log(
      `    Solar    : ${rpad(
        wh(scenario.solarWh),
        6,
      )} Wh  @ ${PRICE_SOLAR} ct/kWh`,
    );
  if (scenario.bat1Wh > 0)
    console.log(
      `    Battery 1: ${rpad(
        wh(scenario.bat1Wh),
        6,
      )} Wh  @ ${PRICE_BAT_1} ct/kWh`,
    );
  if (scenario.bat2Wh > 0)
    console.log(
      `    Battery 2: ${rpad(
        wh(scenario.bat2Wh),
        6,
      )} Wh  @ ${PRICE_BAT_2} ct/kWh`,
    );
  console.log(`    Total    : ${rpad(wh(totalSupply), 6)} Wh`);
  console.log('  Consumption:');
  scenario.hhDemands.forEach((d, i) =>
    console.log(`    HH ${i + 1}    : ${rpad(wh(d), 6)} Wh`),
  );
  console.log(`    Total    : ${rpad(wh(totalDemand), 6)} Wh`);
  const diff = totalDemand - totalSupply;
  if (diff > 0) console.log(`  Shortfall  : ${wh(diff)} Wh → grid import`);
  else if (diff < 0) console.log(`  Surplus    : ${wh(-diff)} Wh → export`);
  else console.log('  Balance    : supply = demand');

  // ── Run the 3-pass fair-split algorithm ──

  const consumption = new Map<string, number>();
  state.households.forEach((a, i) => {
    if (scenario.hhDemands[i] > 0) consumption.set(a, scenario.hhDemands[i]);
  });

  const production = new Map<string, number>();
  if (scenario.solarWh > 0)
    production.set(state.solarSourceId, scenario.solarWh);
  if (scenario.bat1Wh > 0)
    production.set(state.battery1SourceId, scenario.bat1Wh);
  if (scenario.bat2Wh > 0)
    production.set(state.battery2SourceId, scenario.bat2Wh);

  const input: FairSplitInput = {
    members: allAddrs,
    consumption,
    production,
    sources,
    gridImportPrice: PRICE_IMPORT,
    gridExportPrice: PRICE_EXPORT,
  };

  console.log(`\n  ${'─'.repeat(74)}`);
  console.log('  VPP FAIR-SPLIT ALGORITHM');
  console.log(`  ${'─'.repeat(74)}`);
  console.log(
    '\n  Pass 1: Ownership allocation (share = bps × production / 10000)\n',
  );

  const trace = createTraceRenderer(state);
  const result = fairSplit(input, trace);

  printFinalAllocation(result, input, state);

  // ── Build contract readings ──

  const contractReadings = buildConsumptionReadings(
    result,
    sources,
    memberInfos,
    Number(EXPORT_DEVICE_ID),
    PRICE_IMPORT,
    PRICE_EXPORT,
    QUANTITY_SCALE,
  );

  const solReadings = contractReadings.map((r) => ({
    deviceId: r.deviceId,
    quantity: r.quantity,
    pricePerKwh: r.pricePerKwh,
    sourceId: r.sourceId,
  }));

  printContractReadings(solReadings, state);

  // ── Submit to contract ──

  console.log(`\n  ${'─'.repeat(74)}`);
  console.log('  ON-CHAIN SUBMISSION');
  console.log(`  ${'─'.repeat(74)}`);

  try {
    console.log('  Dry-run (staticCall)...');
    await ppa.consumeEnergy.staticCall(solReadings);
    console.log('  Dry-run: OK ✓');
  } catch (e: any) {
    console.error(`  ✗ staticCall reverted: ${e.reason ?? e.message}`);
    throw e;
  }

  console.log('  Sending consumeEnergy transaction...');
  const tx = await ppa.consumeEnergy(solReadings);
  const receipt = await tx.wait();
  console.log(`  TX hash  : ${receipt?.hash}`);
  console.log(`  Gas used : ${receipt?.gasUsed.toString()}`);
  console.log(`  Block    : ${receipt?.blockNumber}`);

  // ── On-chain state AFTER ──

  await printOnChainState(ppa, state, 'ON-CHAIN STATE AFTER');
}

// ── Setup display ──────────────────────────────────────────────────────────

async function printSetup(state: DemoState, ppa: any): Promise<void> {
  console.log(`\n  ${THIN}`);
  console.log('  Community setup');
  console.log(`  ${THIN}`);
  console.log(`  PPA proxy      : ${state.ppaProxy}`);
  console.log(`  Energy token   : ${state.energyToken}`);
  console.log(`  Solar token    : ${state.solarToken}`);
  console.log(`  Battery 1 token: ${state.battery1Token}`);
  console.log(`  Battery 2 token: ${state.battery2Token}`);
  console.log(`  Export device  : ${EXPORT_DEVICE_ID}`);
  console.log();
  console.log('  Members:');
  for (let i = 0; i < state.households.length; i++)
    console.log(
      `    HH ${i + 1}  : ${state.households[i]}  (device ${HH_DEVICE_IDS[i]})`,
    );
  for (let i = 0; i < state.investors.length; i++)
    console.log(`    Inv ${i + 1} : ${state.investors[i]}  (no device)`);
  console.log();
  console.log('  Ownership:');
  console.log('    Solar     — HH 1-5: 10% each, Inv 1-2: 25% each');
  console.log('    Battery 1 — Inv 1: 50%, Inv 2: 50%');
  console.log('    Battery 2 — Inv 2: 100%');
  console.log();
  const fmtPrice = (label: string, ct: bigint) =>
    `${label}: ${ct} ct/kWh (€${(Number(ct) / 100).toFixed(2)}/kWh)`;
  console.log('  Pricing (euro cents per kWh):');
  console.log(
    `    ${fmtPrice('Solar', PRICE_SOLAR)}  ${fmtPrice(
      'Bat1',
      PRICE_BAT_1,
    )}  ${fmtPrice('Bat2', PRICE_BAT_2)}`,
  );
  console.log(
    `    ${fmtPrice('Import', PRICE_IMPORT)}  ${fmtPrice(
      'Export',
      PRICE_EXPORT,
    )}`,
  );
  console.log();
  const communityBps = Number(await ppa.getCommunityFeeBps());
  const aggregatorBps = Number(await ppa.getAggregatorFeeBps());
  const commAddr: string = await ppa.getCommunityAddress();
  const aggrAddr: string = await ppa.getAggregatorAddress();
  const gridOp: string = await ppa.getGridOperator();
  console.log(
    `  Fees: community ${communityBps / 100}% (${shortAddr(
      commAddr,
    )})  aggregator ${aggregatorBps / 100}% (${shortAddr(aggrAddr)})` +
      (communityBps === 0 && aggregatorBps === 0 ? '  (none configured)' : ''),
  );
  console.log(
    `  Grid operator: ${gridOp === ethers.ZeroAddress ? '(none)' : gridOp}`,
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const command = (getEnv('ENERGY_DEMO_COMMAND') ?? 'loop').toLowerCase();
  const loopMs = Number(getEnv('ENERGY_DEMO_LOOP_MS') ?? '45000');

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(signer.address);

  console.log(SEP);
  console.log('  EnergyPPAv2 — VPP Fair-Split Settlement Loop');
  console.log(SEP);
  console.log(`  Chain     : ${network.chainId}`);
  console.log(`  Command   : ${command}`);
  console.log(`  Admin     : ${signer.address}`);
  console.log(`  Balance   : ${ethers.formatEther(balance)} ETH`);
  console.log();
  console.log('  Unit convention:');
  console.log(
    '    1 credit = 1 euro cent (€0.01).  Prices in ct/kWh, quantities in kWh.',
  );
  console.log(
    '    Stablecoin (EURC, 6 dec): 1 credit × 10,000 = stablecoin base units.',
  );

  const state = loadState();
  if (state.networkChainId !== Number(network.chainId)) {
    throw new Error(
      `State chain ${state.networkChainId} != network ${network.chainId}`,
    );
  }

  const ppa = await ethers.getContractAt('EnergyPPAv2', state.ppaProxy, signer);

  await printSetup(state, ppa);

  const whitelisted = await ppa.isAddressWhitelisted(signer.address);
  if (!whitelisted)
    throw new Error(`Signer ${signer.address} is not whitelisted`);
  console.log(`\n  Signer whitelisted: ✓`);

  if (command === 'reset') {
    console.log('\n  Calling emergencyReset()...');
    await printOnChainState(ppa, state, 'ON-CHAIN STATE BEFORE RESET');
    const tx = await ppa.emergencyReset();
    const receipt = await tx.wait();
    console.log(`\n  emergencyReset() TX: ${receipt?.hash}`);
    console.log(`  Gas used: ${receipt?.gasUsed.toString()}`);
    await printOnChainState(ppa, state, 'ON-CHAIN STATE AFTER RESET');
    return;
  }

  if (command === 'once') {
    await runBatch(ppa, state, 1);
    return;
  }

  if (command === 'loop' || command === 'run') {
    console.log(
      `\n  Loop mode: batch every ${loopMs / 1000}s (Ctrl+C to stop)`,
    );
    let batch = 1;
    for (;;) {
      try {
        await runBatch(ppa, state, batch);
        batch++;
      } catch (e: any) {
        console.error(`\n  ✗ Batch ${batch} failed: ${e.reason ?? e.message}`);
        console.error(e);
      }
      console.log(`\n  Sleeping ${loopMs / 1000}s before next batch...`);
      await sleep(loopMs);
    }
  }

  throw new Error(`Unknown command: ${command}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
