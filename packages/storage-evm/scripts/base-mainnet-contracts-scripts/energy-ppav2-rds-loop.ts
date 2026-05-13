/**
 * EnergyPPAv2 — AWS RDS interval ingestion loop
 *
 * Polls accounting.interval_readings for new 15-minute rows, converts each
 * interval into ConsumptionReading[], and submits consumeEnergy() on-chain.
 *
 * Defaults are conservative:
 * - If no checkpoint file exists, it starts from the latest DB interval
 *   (no historical replay).
 * - Set ENERGY_RDS_CATCH_UP=1 to process all existing intervals from oldest.
 */

import * as fs from 'fs';
import * as path from 'path';

import hre, { ethers } from 'hardhat';
import dotenv from 'dotenv';
import { Client } from 'pg';

import { readOnChainConfig } from '../../vpp/on-chain-reader';
import { runIntervalWithConfig } from '../../vpp/run-interval';
import type { IntervalReading, VppConfig } from '../../vpp/types';

dotenv.config();

interface DemoState {
  networkChainId: number;
  communityId: string;
  ppaProxy: string;
  solarSourceId: string;
  battery1SourceId: string;
  battery2SourceId: string;
}

interface CheckpointState {
  lastProcessedIntervalStart: string | null;
}

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

interface TxReceipt {
  hash?: string;
  gasUsed?: bigint;
}

interface EnergyPpaContract {
  consumeEnergy: {
    (
      payload: Array<{
        deviceId: bigint;
        quantity: bigint;
        pricePerKwh: bigint;
        sourceId: string;
      }>,
    ): Promise<{ wait: () => Promise<TxReceipt | null> }>;
    staticCall: (
      payload: Array<{
        deviceId: bigint;
        quantity: bigint;
        pricePerKwh: bigint;
        sourceId: string;
      }>,
    ) => Promise<unknown>;
  };
  isAddressWhitelisted: (address: string) => Promise<boolean>;
}

const SEP = '═'.repeat(78);
const COMMUNITY_ID_DEFAULT = 0;
const POLL_MS_DEFAULT = 15 * 60 * 1000;
const QUANTITY_SCALE = 1000;

// Demo integration mapping from ENERGY_INTERVAL_DATA_FEED.md.
const PROD_METER_SOLAR = 9001;
const PROD_METER_BATTERY_1 = 9002;
const PROD_METER_BATTERY_2 = 9003;

function getEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

function getRequiredEnv(name: string): string {
  const v = getEnv(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rpcHostForLog(): string {
  const url = (hre.network.config as { url?: string }).url ?? '';
  if (!url) return '(unknown)';
  try {
    return new URL(url).hostname;
  } catch {
    return '(configured)';
  }
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

function checkpointFilePath(): string {
  const custom = getEnv('ENERGY_RDS_CHECKPOINT_FILE');
  if (custom)
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  return path.join(__dirname, 'energy-ppav2-rds-loop-state.json');
}

function readCheckpoint(): CheckpointState {
  const p = checkpointFilePath();
  if (!fs.existsSync(p)) return { lastProcessedIntervalStart: null };
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as CheckpointState;
}

function writeCheckpoint(state: CheckpointState): void {
  const p = checkpointFilePath();
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n');
}

function buildDbConfig(): DbConfig {
  return {
    host: getRequiredEnv('ENERGY_RDS_HOST'),
    port: Number(getEnv('ENERGY_RDS_PORT') ?? '5432'),
    database: getRequiredEnv('ENERGY_RDS_DATABASE'),
    user: getRequiredEnv('ENERGY_RDS_USER'),
    password: getRequiredEnv('ENERGY_RDS_PASSWORD'),
    ssl: (getEnv('ENERGY_RDS_SSL') ?? '1') !== '0',
  };
}

function buildVppConfig(state: DemoState): VppConfig {
  return {
    productionDeviceToSource: new Map<number, string>([
      [PROD_METER_SOLAR, state.solarSourceId],
      [PROD_METER_BATTERY_1, state.battery1SourceId],
      [PROD_METER_BATTERY_2, state.battery2SourceId],
    ]),
  };
}

async function fetchLatestIntervalStart(
  client: Client,
  communityId: number,
): Promise<string | null> {
  const r = await client.query<{ interval_start: string | null }>(
    `select max(interval_start)::text as interval_start
     from accounting.interval_readings
     where community_id = $1`,
    [communityId],
  );
  return r.rows[0]?.interval_start ?? null;
}

async function fetchRowsSince(
  client: Client,
  communityId: number,
  sinceExclusive: string | null,
): Promise<IntervalReading[]> {
  const baseSql = `
    select
      interval_start::text as interval_start,
      meter_id,
      community_id,
      energy_wh,
      direction
    from accounting.interval_readings
    where community_id = $1
  `;
  const sql =
    sinceExclusive == null
      ? `${baseSql} order by interval_start asc, meter_id asc, direction asc`
      : `${baseSql} and interval_start > $2::timestamptz order by interval_start asc, meter_id asc, direction asc`;
  const params =
    sinceExclusive == null ? [communityId] : [communityId, sinceExclusive];
  const r = await client.query<IntervalReading>(sql, params);
  return r.rows;
}

function groupByInterval(
  rows: IntervalReading[],
): Map<string, IntervalReading[]> {
  const grouped = new Map<string, IntervalReading[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.interval_start) ?? [];
    bucket.push(row);
    grouped.set(row.interval_start, bucket);
  }
  return grouped;
}

async function submitInterval(
  ppa: EnergyPpaContract,
  intervalStart: string,
  rows: IntervalReading[],
  state: DemoState,
): Promise<void> {
  const onChainConfig = await readOnChainConfig(
    ethers.provider,
    state.ppaProxy,
  );
  const vppConfig = buildVppConfig(state);
  const readings = runIntervalWithConfig(
    rows,
    onChainConfig,
    vppConfig,
    { importPricePerKwh: 30n, exportPricePerKwh: 8n },
    { quantityScale: QUANTITY_SCALE },
  );

  const payload = readings.map((r) => ({
    deviceId: r.deviceId,
    quantity: r.quantity,
    pricePerKwh: r.pricePerKwh,
    sourceId: r.sourceId,
  }));

  if (payload.length === 0) {
    console.log(
      `  ${intervalStart} -> no contract readings generated, skipping submit`,
    );
    return;
  }

  console.log(
    `  ${intervalStart} -> ${rows.length} DB rows -> ${payload.length} on-chain readings`,
  );
  await ppa.consumeEnergy.staticCall(payload);
  const tx = await ppa.consumeEnergy(payload);
  const receipt = await tx.wait();
  console.log(
    `    submitted tx=${receipt?.hash} gas=${receipt?.gasUsed.toString()}`,
  );
}

async function main(): Promise<void> {
  const command = (getEnv('ENERGY_DEMO_COMMAND') ?? 'loop').toLowerCase();
  const pollMs = Number(getEnv('ENERGY_RDS_POLL_MS') ?? `${POLL_MS_DEFAULT}`);
  const catchUp = (getEnv('ENERGY_RDS_CATCH_UP') ?? '0') === '1';

  const state = loadState();
  const communityId = Number(
    getEnv('ENERGY_RDS_COMMUNITY_ID') ??
      state.communityId ??
      COMMUNITY_ID_DEFAULT,
  );
  const dbConfig = buildDbConfig();

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (state.networkChainId !== Number(network.chainId)) {
    throw new Error(
      `State chain ${state.networkChainId} != network ${network.chainId}`,
    );
  }

  const ppa = (await ethers.getContractAt(
    'EnergyPPAv2',
    state.ppaProxy,
    signer,
  )) as unknown as EnergyPpaContract;
  const whitelisted = await ppa.isAddressWhitelisted(signer.address);
  if (!whitelisted) {
    throw new Error(`Signer ${signer.address} is not whitelisted`);
  }

  console.log(SEP);
  console.log('  EnergyPPAv2 — AWS RDS Ingestion Loop');
  console.log(SEP);
  console.log(`  Chain               : ${network.chainId}`);
  console.log(`  Contract            : ${state.ppaProxy}`);
  console.log(`  Community ID        : ${communityId}`);
  console.log(`  Command             : ${command}`);
  console.log(`  Poll interval       : ${pollMs / 1000}s`);
  console.log(`  DB host             : ${dbConfig.host}:${dbConfig.port}`);
  console.log(`  DB name             : ${dbConfig.database}`);
  console.log(`  Catch-up mode       : ${catchUp ? 'on' : 'off'}`);
  console.log(`  Checkpoint file     : ${checkpointFilePath()}`);
  console.log(`  Signer whitelisted  : yes (${signer.address})`);
  console.log(`  RPC host            : ${rpcHostForLog()}`);

  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  console.log('\n  DB connection: OK');

  try {
    const checkpoint = readCheckpoint();
    if (!checkpoint.lastProcessedIntervalStart && !catchUp) {
      const latest = await fetchLatestIntervalStart(client, communityId);
      checkpoint.lastProcessedIntervalStart = latest;
      writeCheckpoint(checkpoint);
      if (latest) {
        console.log(`  Initialized checkpoint to latest interval: ${latest}`);
      } else {
        console.log('  No intervals yet; waiting for first data point');
      }
    }

    const processOnce = async (): Promise<void> => {
      const current = readCheckpoint();
      const rows = await fetchRowsSince(
        client,
        communityId,
        current.lastProcessedIntervalStart,
      );
      if (rows.length === 0) {
        console.log(
          `\n[${new Date().toISOString()}] No new intervals after ${
            current.lastProcessedIntervalStart ?? 'start'
          }`,
        );
        return;
      }

      const grouped = groupByInterval(rows);
      const intervals = [...grouped.keys()].sort();
      console.log(
        `\n[${new Date().toISOString()}] Found ${
          intervals.length
        } new interval(s)`,
      );

      for (const intervalStart of intervals) {
        const bucket = grouped.get(intervalStart) ?? [];
        await submitInterval(ppa, intervalStart, bucket, state);
        writeCheckpoint({ lastProcessedIntervalStart: intervalStart });
      }
    };

    if (command === 'once') {
      await processOnce();
      return;
    }

    if (command === 'loop' || command === 'run') {
      for (;;) {
        try {
          await processOnce();
        } catch (err: unknown) {
          const e = err as { reason?: string; message?: string };
          console.error(
            `[${new Date().toISOString()}] iteration failed: ${
              e.reason ?? e.message ?? String(err)
            }`,
          );
          console.error(err);
        }
        await sleep(pollMs);
      }
    }

    throw new Error(`Unknown command: ${command}`);
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
