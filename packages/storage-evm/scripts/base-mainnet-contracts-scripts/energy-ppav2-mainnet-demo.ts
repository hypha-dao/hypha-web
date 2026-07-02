/**
 * EnergyPPAv2 mainnet demo
 *
 * Community:
 *   5 households (HH 1-5) — each with a smart meter (device 1-5)
 *   2 investors (Inv 1, Inv 2) — no meters, pure revenue recipients
 *
 * Energy sources:
 *   Solar park  — co-owned: HH 1-5 @ 10% each, Inv 1-2 @ 25% each
 *   Battery 1   — co-owned: Inv 1 50%, Inv 2 50%
 *   Battery 2   — owned 100% by Inv 2
 *
 * Grid interaction (via export device 9999):
 *   Import  — when local supply < demand, households buy from grid @ 30/kWh
 *   Export  — when local supply > demand and no import, surplus solar
 *             is exported to grid @ 8/kWh via the export device
 *
 * gridBalance (single value on-chain):
 *   negative = community imported more than exported (owes grid)
 *   positive = community exported more than imported (grid owes community)
 *
 * Usage:
 *   ENERGY_DEMO_COMMAND=deploy  npx hardhat run ... --network base-mainnet
 *   ENERGY_DEMO_COMMAND=once    npx hardhat run ... --network base-mainnet
 *   ENERGY_DEMO_COMMAND=loop    npx hardhat run ... --network base-mainnet
 */

import * as fs from 'fs';
import * as path from 'path';

import { HDNodeWallet, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'hardhat';

import dotenv from 'dotenv';

dotenv.config();

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_STATE_BASENAME = 'energy-ppav2-demo-state.json';
const REGULAR_SPACE_TOKEN_FQN =
  'contracts/RegularSpaceToken.sol:RegularSpaceToken';

const BASE_MAINNET_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const SOLAR_SOURCE_ID = keccak256(toUtf8Bytes('DEMO_SOLAR_V5'));
const BATTERY_1_SOURCE_ID = keccak256(toUtf8Bytes('DEMO_BATTERY_1_V5'));
const BATTERY_2_SOURCE_ID = keccak256(toUtf8Bytes('DEMO_BATTERY_2_V5'));
const IMPORT_SOURCE_ID = keccak256(toUtf8Bytes('IMPORT'));

const HH_DEVICE_IDS = [1n, 2n, 3n, 4n, 5n] as const;
const EXPORT_DEVICE_ID = 9999n;

const PRICE_SOLAR = 10n;
const PRICE_BAT_1 = 15n;
const PRICE_BAT_2 = 12n;
const PRICE_IMPORT = 30n;
const PRICE_EXPORT = 8n;

// ── Types ──────────────────────────────────────────────────────────────

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

interface Reading {
  deviceId: bigint;
  quantity: bigint;
  pricePerKwh: bigint;
  sourceId: string;
}

interface IntervalPlan {
  solarProduction: bigint;
  bat1Available: bigint;
  bat2Available: bigint;
  hhDemands: bigint[];
  totalDemand: bigint;
  totalLocalSupply: bigint;
  solarUsed: bigint;
  bat1Used: bigint;
  bat2Used: bigint;
  importQty: bigint;
  exportQty: bigint;
  readings: Reading[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function getEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

function stateFilePath(): string {
  const custom = getEnv('ENERGY_PPAV2_STATE_FILE');
  if (custom)
    return path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom);
  return path.join(__dirname, DEFAULT_STATE_BASENAME);
}

function loadState(): DemoState | null {
  const p = stateFilePath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as DemoState;
}

function saveState(s: DemoState): void {
  const p = stateFilePath();
  fs.writeFileSync(p, JSON.stringify(s, null, 2));
  console.log(`  State saved: ${p}`);
}

function rand(min: number, max: number): bigint {
  return BigInt(min + Math.floor(Math.random() * (max - min + 1)));
}

// ── Actor generation (10: 5 HH + 2 investors + community + aggregator + grid operator)

interface Actors {
  households: string[];
  investors: string[];
  communityAddress: string;
  aggregatorAddress: string;
  gridOperator: string;
}

function deriveActors(): Actors {
  const mnemonic = getEnv('ENERGY_TEST_MNEMONIC');
  const keysRaw = getEnv('ENERGY_ACTOR_PRIVATE_KEYS');
  const addresses: string[] = [];

  if (mnemonic) {
    for (let i = 0; i < 10; i++) {
      addresses.push(
        HDNodeWallet.fromPhrase(mnemonic, undefined, `m/44'/60'/0'/0/${i}`)
          .address,
      );
    }
  } else if (keysRaw) {
    const parts = keysRaw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (parts.length < 7)
      throw new Error('ENERGY_ACTOR_PRIVATE_KEYS must have at least 7 keys');
    for (const k of parts) {
      addresses.push(new Wallet(k.startsWith('0x') ? k : `0x${k}`).address);
    }
    while (addresses.length < 10) addresses.push(Wallet.createRandom().address);
  } else {
    console.log('  Generating random actor addresses (no signing needed).');
    for (let i = 0; i < 10; i++) addresses.push(Wallet.createRandom().address);
  }

  return {
    households: addresses.slice(0, 5),
    investors: addresses.slice(5, 7),
    communityAddress: addresses[7],
    aggregatorAddress: addresses[8],
    gridOperator: addresses[9],
  };
}

// ── Factory / RST resolution ───────────────────────────────────────────

async function resolveRSTImplementation(): Promise<string> {
  const explicit = getEnv('REGULAR_SPACE_TOKEN_IMPL');
  if (explicit && ethers.isAddress(explicit)) {
    const code = await ethers.provider.getCode(explicit);
    if (code !== '0x') {
      console.log(`  Reusing RST impl: ${explicit}`);
      return explicit;
    }
    throw new Error(`RST impl has no code: ${explicit}`);
  }

  console.log('  Deploying RegularSpaceToken implementation...');
  const RST = await ethers.getContractFactory(REGULAR_SPACE_TOKEN_FQN);
  const rstContract = await RST.deploy();
  await rstContract.waitForDeployment();
  const addr = await rstContract.getAddress();
  console.log(`  RST impl: ${addr}`);
  return addr;
}

async function deployFactoryIfNeeded(): Promise<string> {
  const existing = getEnv('ENERGY_PPAV2_FACTORY');
  if (existing && ethers.isAddress(existing)) {
    const code = await ethers.provider.getCode(existing);
    if (code === '0x') throw new Error(`Factory has no code: ${existing}`);
    console.log(`  Reusing factory: ${existing}`);
    return existing;
  }

  if (getEnv('DEPLOY_FACTORY') !== '1')
    throw new Error('Set ENERGY_PPAV2_FACTORY or DEPLOY_FACTORY=1');

  console.log('  Deploying EnergyPPAv2 impl...');
  const PPA = await ethers.getContractFactory('EnergyPPAv2');
  const ppaImplContract = await PPA.deploy();
  await ppaImplContract.waitForDeployment();
  const ppaImpl = await ppaImplContract.getAddress();
  console.log(`  EnergyPPAv2 impl: ${ppaImpl}`);

  const rstImpl = await resolveRSTImplementation();

  const Factory = await ethers.getContractFactory('EnergyPPAv2Factory');
  const factory = await Factory.deploy(ppaImpl, rstImpl);
  await factory.waitForDeployment();
  const addr = await factory.getAddress();
  console.log(`  Factory: ${addr}`);
  return addr;
}

// ── Community deployment ───────────────────────────────────────────────

async function deployCommunity(
  factoryAddress: string,
  adminAddress: string,
  actors: Actors,
): Promise<DemoState> {
  const factory = await ethers.getContractAt(
    'EnergyPPAv2Factory',
    factoryAddress,
  );
  const stablecoin = getEnv('ENERGY_DEMO_STABLECOIN') ?? BASE_MAINNET_USDC;

  const [h1, h2, h3, h4, h5] = actors.households;
  const [inv1, inv2] = actors.investors;

  const params = {
    admin: adminAddress,
    stablecoin,
    communityAddress: actors.communityAddress,
    aggregatorAddress: actors.aggregatorAddress,
    gridOperator: actors.gridOperator,
    communityFeeBps: 500,
    aggregatorFeeBps: 300,
    exportDeviceId: EXPORT_DEVICE_ID,
    energyTokenName: 'PPA Demo Energy v5',
    energyTokenSymbol: 'PPA-DEMO5',
    sources: [
      {
        sourceId: SOLAR_SOURCE_ID,
        sourceType: 0,
        tokenName: 'Demo Solar Park',
        tokenSymbol: 'D-SOLAR',
        basePricePerKwh: PRICE_SOLAR,
        holders: [h1, h2, h3, h4, h5, inv1, inv2],
        holderAmounts: [1000n, 1000n, 1000n, 1000n, 1000n, 2500n, 2500n],
      },
      {
        sourceId: BATTERY_1_SOURCE_ID,
        sourceType: 1,
        tokenName: 'Demo Battery 1',
        tokenSymbol: 'D-BAT1',
        basePricePerKwh: PRICE_BAT_1,
        holders: [inv1, inv2],
        holderAmounts: [5000n, 5000n],
      },
      {
        sourceId: BATTERY_2_SOURCE_ID,
        sourceType: 1,
        tokenName: 'Demo Battery 2',
        tokenSymbol: 'D-BAT2',
        basePricePerKwh: PRICE_BAT_2,
        holders: [inv2],
        holderAmounts: [10000n],
      },
    ],
    members: [
      {
        memberAddress: h1,
        deviceIds: [HH_DEVICE_IDS[0]],
        metadataHash: ethers.ZeroHash,
      },
      {
        memberAddress: h2,
        deviceIds: [HH_DEVICE_IDS[1]],
        metadataHash: ethers.ZeroHash,
      },
      {
        memberAddress: h3,
        deviceIds: [HH_DEVICE_IDS[2]],
        metadataHash: ethers.ZeroHash,
      },
      {
        memberAddress: h4,
        deviceIds: [HH_DEVICE_IDS[3]],
        metadataHash: ethers.ZeroHash,
      },
      {
        memberAddress: h5,
        deviceIds: [HH_DEVICE_IDS[4]],
        metadataHash: ethers.ZeroHash,
      },
      { memberAddress: inv1, deviceIds: [], metadataHash: ethers.ZeroHash },
      { memberAddress: inv2, deviceIds: [], metadataHash: ethers.ZeroHash },
    ],
  };

  try {
    await factory.deployCommunity.staticCall(params);
    console.log('  staticCall OK ✓');
  } catch (e: any) {
    console.error(`  staticCall REVERTED: ${e.reason ?? e.message}`);
    throw e;
  }

  const tx = await factory.deployCommunity(params);
  console.log(`  deployCommunity TX: ${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('deployCommunity: no receipt');

  const event = receipt.logs
    .map((log: any) => {
      try {
        return factory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
      } catch {
        return null;
      }
    })
    .find((e: any) => e?.name === 'CommunityDeployed');

  if (!event) throw new Error('CommunityDeployed event not found');

  const sourceTokens = event.args.sourceTokens as string[];
  const sourceIds = event.args.sourceIds as string[];
  const network = await ethers.provider.getNetwork();

  return {
    networkChainId: Number(network.chainId),
    factory: factoryAddress,
    communityId: event.args.communityId.toString(),
    ppaProxy: event.args.proxy as string,
    energyToken: event.args.energyToken as string,
    solarToken: sourceTokens[0],
    battery1Token: sourceTokens[1],
    battery2Token: sourceTokens[2],
    solarSourceId: sourceIds[0],
    battery1SourceId: sourceIds[1],
    battery2SourceId: sourceIds[2],
    households: actors.households,
    investors: actors.investors,
    deployedAt: new Date().toISOString(),
  };
}

// ── Formatting helpers ─────────────────────────────────────────────────

const SEP = '='.repeat(80);
const THIN = '-'.repeat(80);

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function rpad(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}
function shortAddr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

// ── Interval planning (supply/demand allocation) ───────────────────────

function planInterval(): IntervalPlan {
  const solarProduction = rand(40, 100);
  const bat1Available = rand(5, 25);
  const bat2Available = rand(3, 15);
  const hhDemands = Array.from({ length: 5 }, () => rand(8, 25));
  const totalDemand = hhDemands.reduce((a, b) => a + b, 0n);
  const totalLocalSupply = solarProduction + bat1Available + bat2Available;

  let remaining = totalDemand;
  const solarUsed = remaining < solarProduction ? remaining : solarProduction;
  remaining -= solarUsed;
  const bat1Used = remaining < bat1Available ? remaining : bat1Available;
  remaining -= bat1Used;
  const bat2Used = remaining < bat2Available ? remaining : bat2Available;
  remaining -= bat2Used;
  const importQty = remaining;

  const hasImport = importQty > 0n;
  const exportQty =
    !hasImport && solarProduction > solarUsed
      ? solarProduction - solarUsed
      : 0n;

  const readings: Reading[] = [];

  for (let i = 0; i < 5; i++) {
    const demand = hhDemands[i];
    if (demand === 0n) continue;

    const solarShare = solarUsed > 0n ? (demand * solarUsed) / totalDemand : 0n;
    const bat1Share = bat1Used > 0n ? (demand * bat1Used) / totalDemand : 0n;
    const bat2Share = bat2Used > 0n ? (demand * bat2Used) / totalDemand : 0n;

    let hhSolar = solarShare;
    const hhBat1 = bat1Share;
    const hhBat2 = bat2Share;
    let hhImport = 0n;

    const allocated = hhSolar + hhBat1 + hhBat2;
    if (allocated < demand) {
      if (importQty > 0n) {
        hhImport = demand - allocated;
      } else {
        hhSolar += demand - allocated;
      }
    }

    const total = hhSolar + hhBat1 + hhBat2 + hhImport;
    if (total !== demand) hhSolar += demand - total;

    if (hhSolar > 0n)
      readings.push({
        deviceId: HH_DEVICE_IDS[i],
        quantity: hhSolar,
        pricePerKwh: PRICE_SOLAR,
        sourceId: SOLAR_SOURCE_ID,
      });
    if (hhBat1 > 0n)
      readings.push({
        deviceId: HH_DEVICE_IDS[i],
        quantity: hhBat1,
        pricePerKwh: PRICE_BAT_1,
        sourceId: BATTERY_1_SOURCE_ID,
      });
    if (hhBat2 > 0n)
      readings.push({
        deviceId: HH_DEVICE_IDS[i],
        quantity: hhBat2,
        pricePerKwh: PRICE_BAT_2,
        sourceId: BATTERY_2_SOURCE_ID,
      });
    if (hhImport > 0n)
      readings.push({
        deviceId: HH_DEVICE_IDS[i],
        quantity: hhImport,
        pricePerKwh: PRICE_IMPORT,
        sourceId: IMPORT_SOURCE_ID,
      });
  }

  if (exportQty > 0n) {
    readings.push({
      deviceId: EXPORT_DEVICE_ID,
      quantity: exportQty,
      pricePerKwh: PRICE_EXPORT,
      sourceId: SOLAR_SOURCE_ID,
    });
  }

  return {
    solarProduction,
    bat1Available,
    bat2Available,
    hhDemands,
    totalDemand,
    totalLocalSupply,
    solarUsed,
    bat1Used,
    bat2Used,
    importQty,
    exportQty,
    readings,
  };
}

// ── Display ────────────────────────────────────────────────────────────

async function printFullState(
  ppa: any,
  state: DemoState,
  heading: string,
): Promise<void> {
  console.log(`\n${THIN}`);
  console.log(heading);
  console.log(THIN);

  const hdr = `  ${pad('Member', 7)} ${pad('Address', 13)} ${rpad(
    'Solar',
    7,
  )} ${rpad('Bat1', 7)} ${rpad('Bat2', 7)} ${rpad('Credit', 12)}`;
  const div = `  ${'-'.repeat(7)} ${'-'.repeat(13)} ${'-'.repeat(
    7,
  )} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(12)}`;
  console.log(hdr);
  console.log(div);

  const allMembers = [
    ...state.households.map((a, i) => ({ label: `HH ${i + 1}`, address: a })),
    ...state.investors.map((a, i) => ({ label: `Inv ${i + 1}`, address: a })),
  ];

  for (const { label, address } of allMembers) {
    const sBps = Number(
      await ppa.getSourceOwnershipBps(SOLAR_SOURCE_ID, address),
    );
    const b1Bps = Number(
      await ppa.getSourceOwnershipBps(BATTERY_1_SOURCE_ID, address),
    );
    const b2Bps = Number(
      await ppa.getSourceOwnershipBps(BATTERY_2_SOURCE_ID, address),
    );
    const credit = (await ppa.getEnergyCreditBalance(address)).toString();
    console.log(
      `  ${pad(label, 7)} ${pad(shortAddr(address), 13)} ${rpad(
        `${sBps / 100}%`,
        7,
      )} ${rpad(`${b1Bps / 100}%`, 7)} ${rpad(`${b2Bps / 100}%`, 7)} ${rpad(
        credit,
        12,
      )}`,
    );
  }

  const gridRaw: bigint = await ppa.getGridBalance();
  const gridDisplay = -gridRaw;
  const settled: bigint = await ppa.getSettledBalance();
  console.log();

  const gridNote =
    gridRaw > 0n
      ? '(grid owes community for exports)'
      : gridRaw < 0n
      ? '(community owes grid for imports)'
      : '(balanced)';
  console.log(
    `  Grid account   : ${rpad(gridDisplay.toString(), 10)}  ${gridNote}`,
  );
  console.log(`  Settled balance: ${rpad(settled.toString(), 10)}`);

  const [ok, sum] = await ppa.verifyZeroSum();
  console.log(
    `  Zero-sum       : ${ok ? 'PASS' : 'FAIL'}  (sum = ${sum.toString()})`,
  );
}

function printInterval(plan: IntervalPlan): void {
  console.log(`\n${THIN}`);
  console.log('Interval: supply & demand');
  console.log(THIN);

  console.log(`  Supply:`);
  console.log(
    `    Solar production : ${rpad(plan.solarProduction.toString(), 4)} kWh`,
  );
  console.log(
    `    Battery 1 avail  : ${rpad(plan.bat1Available.toString(), 4)} kWh`,
  );
  console.log(
    `    Battery 2 avail  : ${rpad(plan.bat2Available.toString(), 4)} kWh`,
  );
  console.log(
    `    Total local      : ${rpad(plan.totalLocalSupply.toString(), 4)} kWh`,
  );

  console.log(`  Demand:`);
  for (let i = 0; i < 5; i++)
    console.log(
      `    HH ${i + 1}             : ${rpad(
        plan.hhDemands[i].toString(),
        4,
      )} kWh`,
    );
  console.log(
    `    Total demand     : ${rpad(plan.totalDemand.toString(), 4)} kWh`,
  );

  console.log(`  Allocation:`);
  console.log(
    `    Solar used       : ${rpad(
      plan.solarUsed.toString(),
      4,
    )} kWh  @ ${PRICE_SOLAR}/kWh`,
  );
  console.log(
    `    Battery 1 used   : ${rpad(
      plan.bat1Used.toString(),
      4,
    )} kWh  @ ${PRICE_BAT_1}/kWh`,
  );
  console.log(
    `    Battery 2 used   : ${rpad(
      plan.bat2Used.toString(),
      4,
    )} kWh  @ ${PRICE_BAT_2}/kWh`,
  );
  if (plan.importQty > 0n)
    console.log(
      `    Grid IMPORT      : ${rpad(
        plan.importQty.toString(),
        4,
      )} kWh  @ ${PRICE_IMPORT}/kWh`,
    );
  if (plan.exportQty > 0n)
    console.log(
      `    Grid EXPORT      : ${rpad(
        plan.exportQty.toString(),
        4,
      )} kWh  @ ${PRICE_EXPORT}/kWh  (surplus solar)`,
    );
  if (plan.importQty === 0n && plan.exportQty === 0n)
    console.log(`    Grid             : none (exact balance)`);

  console.log(`  Readings sent: ${plan.readings.length}`);
}

// ── Core batch ─────────────────────────────────────────────────────────

async function runConsumeBatch(
  ppaAddress: string,
  state: DemoState,
  batchNum: number,
): Promise<void> {
  const admin = (await ethers.getSigners())[0];
  const ppa = await ethers.getContractAt('EnergyPPAv2', ppaAddress, admin);

  if (batchNum === 1) {
    const whitelisted = await ppa.isAddressWhitelisted(admin.address);
    if (!whitelisted)
      throw new Error(`Signer ${admin.address} is not whitelisted on PPA.`);
  }

  console.log(`\n${SEP}`);
  console.log(`BATCH #${batchNum}  ${new Date().toISOString()}`);
  console.log(SEP);

  await printFullState(ppa, state, 'State BEFORE consumeEnergy');

  const plan = planInterval();
  printInterval(plan);

  try {
    await ppa.consumeEnergy.staticCall(plan.readings);
  } catch (e: any) {
    console.error(`\n  staticCall reverted: ${e.reason ?? e.message}`);
    throw e;
  }

  console.log(`\n  Sending consumeEnergy transaction...`);
  const tx = await ppa.consumeEnergy(plan.readings);
  const receipt = await tx.wait();
  console.log(`  TX confirmed: ${receipt?.hash}`);
  console.log(`  Gas used    : ${receipt?.gasUsed.toString()}`);

  await printFullState(ppa, state, 'State AFTER consumeEnergy');
}

// ── Setup display ──────────────────────────────────────────────────────

function printSetup(state: DemoState): void {
  console.log(`\n${THIN}`);
  console.log('Community setup');
  console.log(THIN);
  console.log(`  PPA proxy      : ${state.ppaProxy}`);
  console.log(`  Energy token   : ${state.energyToken}`);
  console.log(`  Solar token    : ${state.solarToken}`);
  console.log(`  Battery 1 token: ${state.battery1Token}`);
  console.log(`  Battery 2 token: ${state.battery2Token}`);
  console.log(`  Export device  : ${EXPORT_DEVICE_ID}`);
  console.log(`  Deployed at    : ${state.deployedAt}`);
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
  console.log('  Pricing:');
  console.log(
    `    Solar: ${PRICE_SOLAR}/kWh  Bat1: ${PRICE_BAT_1}/kWh  Bat2: ${PRICE_BAT_2}/kWh  Import: ${PRICE_IMPORT}/kWh  Export: ${PRICE_EXPORT}/kWh`,
  );
}

// ── Main ───────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const command = (getEnv('ENERGY_DEMO_COMMAND') ?? 'loop').toLowerCase();
  const skipAutoDeploy = getEnv('ENERGY_DEMO_SKIP_DEPLOY') === '1';
  const loopMs = Number(getEnv('ENERGY_DEMO_LOOP_MS') ?? '45000');

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(SEP);
  console.log('EnergyPPAv2 — Base Mainnet Demo v5');
  console.log(SEP);
  console.log(`  Chain ID  : ${network.chainId}`);
  console.log(`  Command   : ${command}`);
  console.log(`  Admin     : ${deployer.address}`);
  console.log(`  Balance   : ${ethers.formatEther(balance)} ETH`);

  let state = loadState();
  if (state && state.networkChainId !== Number(network.chainId)) {
    throw new Error(
      `State chainId ${state.networkChainId} != network ${network.chainId}`,
    );
  }

  if (command === 'deploy' || (!state && !skipAutoDeploy)) {
    if ((command === 'once' || command === 'loop') && skipAutoDeploy)
      throw new Error('No state file and ENERGY_DEMO_SKIP_DEPLOY=1');

    const actors = deriveActors();
    console.log('\n  Actors:');
    actors.households.forEach((a, i) => console.log(`    HH ${i + 1}  : ${a}`));
    actors.investors.forEach((a, i) => console.log(`    Inv ${i + 1} : ${a}`));
    console.log(`    Comm   : ${actors.communityAddress}`);
    console.log(`    Aggr   : ${actors.aggregatorAddress}`);
    console.log(`    Grid Op: ${actors.gridOperator}`);

    const factoryAddr = await deployFactoryIfNeeded();
    state = await deployCommunity(factoryAddr, deployer.address, actors);
    saveState(state);

    if (command === 'deploy') {
      printSetup(state);
      console.log(
        '\nDeploy complete. Run with ENERGY_DEMO_COMMAND=once or loop.',
      );
      return;
    }
  }

  if (!state)
    throw new Error('No state. Run ENERGY_DEMO_COMMAND=deploy first.');

  printSetup(state);

  if (command === 'once') {
    await runConsumeBatch(state.ppaProxy, state, 1);
    return;
  }

  if (command === 'loop' || command === 'run') {
    console.log(
      `\n  Loop mode: batch every ${loopMs / 1000}s (Ctrl+C to stop)`,
    );
    let batch = 1;
    for (;;) {
      try {
        await runConsumeBatch(state.ppaProxy, state, batch);
        batch++;
      } catch (e) {
        console.error('consumeEnergy failed:', e);
      }
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
