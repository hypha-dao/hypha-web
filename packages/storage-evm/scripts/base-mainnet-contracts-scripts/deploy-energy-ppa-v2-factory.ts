/**
 * Deploy the full EnergyPPAv2 system to Base mainnet:
 *
 *   Step 1 — EnergyPPAv2 implementation (UUPS)
 *   Step 2 — RegularSpaceToken implementation (UUPS) — or reuse existing
 *   Step 3 — EnergyPPAv2Factory(impl, rstImpl)
 *   Step 4 — deployCommunity() with the pre-configured scenario:
 *
 *     Community layout:
 *       • 5 households  (HH1–HH5), each with a smart-meter device
 *       • 2 investors   (INV1, INV2), no meters (pure revenue)
 *       • 1 solar park  — owned by all 7 members
 *           HH1–HH5 each 10 %, INV1 + INV2 each 25 %
 *       • 1 battery     — owned 50/50 by the two investors
 *
 *     Pricing (1 internal unit = 0.01 USDC):
 *       Solar PPA base   :  8 units/kWh  →  $0.08/kWh
 *       Battery base      : 12 units/kWh  →  $0.12/kWh
 *       Community fee     :  5 % (500 bps)
 *       Aggregator fee    :  3 % (300 bps)
 *       Export device     : 100
 *
 * Usage:
 *   npx hardhat run scripts/base-mainnet-contracts-scripts/deploy-energy-ppa-v2-factory.ts --network base-mainnet
 *
 * Env:
 *   PRIVATE_KEY              — deployer wallet (becomes PPA admin)
 *   RPC_URL                  — Base mainnet RPC
 *   REGULAR_SPACE_TOKEN_IMPL — (optional) reuse an existing RST implementation
 *   ENERGY_PPAV2_FACTORY     — (optional) skip factory deploy, use existing
 *   ENERGY_TEST_MNEMONIC     — derive 7 actor addresses (m/44'/60'/0'/0/0..6)
 *   ENERGY_ACTOR_PRIVATE_KEYS— or comma-separated 7 keys (5 HH + 2 investors)
 *   DRY_RUN                  — "true" to compile+validate only
 */

import * as fs from 'fs';
import * as path from 'path';

import { HDNodeWallet, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { ethers } from 'hardhat';

import dotenv from 'dotenv';

dotenv.config();

// ── Constants ────────────────────────────────────────────────────────────────

const REGULAR_SPACE_TOKEN_FQN =
  'contracts/RegularSpaceToken.sol:RegularSpaceToken';

const BASE_MAINNET_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_MAINNET_RST_IMPL = '0x3612C9555f0fa327c892f5cEAD49c98D84aa2565';

const SOLAR_SOURCE_ID = keccak256(toUtf8Bytes('SOLAR_PARK_1'));
const BATTERY_SOURCE_ID = keccak256(toUtf8Bytes('BATTERY_1'));

const HOUSEHOLD_DEVICE_IDS = [101n, 102n, 103n, 104n, 105n] as const;
const EXPORT_DEVICE_ID = 100n;

// Pricing: 1 internal unit = 10,000 stablecoin sub-units = 0.01 USDC
const SOLAR_BASE_PRICE_PER_KWH = 8n; // $0.08 / kWh
const BATTERY_BASE_PRICE_PER_KWH = 12n; // $0.12 / kWh
const COMMUNITY_FEE_BPS = 500; // 5 %
const AGGREGATOR_FEE_BPS = 300; // 3 %

// Ownership token distribution (out of 10 000 total supply per source)
const SOLAR_HH_TOKENS = 1000n; // 10 % each × 5 = 50 %
const SOLAR_INV_TOKENS = 2500n; // 25 % each × 2 = 50 %
const BATTERY_INV_TOKENS = 5000n; // 50 % each × 2 = 100 %

// ── Types ────────────────────────────────────────────────────────────────────

interface DeploymentState {
  networkChainId: number;
  deployer: string;
  energyPPAv2Implementation: string;
  regularSpaceTokenImplementation: string;
  factory: string;
  communityId: string;
  ppaProxy: string;
  energyToken: string;
  solarSourceId: string;
  solarToken: string;
  batterySourceId: string;
  batteryToken: string;
  households: string[];
  investors: string[];
  communityAddress: string;
  aggregatorAddress: string;
  deployedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

function deriveActors(): { households: string[]; investors: string[] } {
  const mnemonic = getEnv('ENERGY_TEST_MNEMONIC');
  const keysRaw = getEnv('ENERGY_ACTOR_PRIVATE_KEYS');

  const addresses: string[] = [];

  if (mnemonic) {
    for (let i = 0; i < 7; i++) {
      const w = HDNodeWallet.fromPhrase(
        mnemonic,
        undefined,
        `m/44'/60'/0'/0/${i}`,
      );
      addresses.push(w.address);
    }
  } else if (keysRaw) {
    const parts = keysRaw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (parts.length !== 7) {
      throw new Error(
        'ENERGY_ACTOR_PRIVATE_KEYS must contain exactly 7 comma-separated private keys (5 HH + 2 investors)',
      );
    }
    for (const k of parts) {
      const normalized = k.startsWith('0x') ? k : `0x${k}`;
      addresses.push(new Wallet(normalized).address);
    }
  } else {
    throw new Error(
      "Set ENERGY_TEST_MNEMONIC (derives 7 addresses from m/44'/60'/0'/0/0–6) or ENERGY_ACTOR_PRIVATE_KEYS (7 comma-separated keys)",
    );
  }

  return {
    households: addresses.slice(0, 5),
    investors: addresses.slice(5, 7),
  };
}

// ── Step 1+2: Implementations ────────────────────────────────────────────────

async function resolveRSTImplementation(): Promise<string> {
  const network = await ethers.provider.getNetwork();
  const isBaseMainnet = Number(network.chainId) === 8453;

  const explicit = getEnv('REGULAR_SPACE_TOKEN_IMPL');
  const candidate =
    explicit ?? (isBaseMainnet ? BASE_MAINNET_RST_IMPL : undefined);

  if (candidate && ethers.isAddress(candidate)) {
    const code = await ethers.provider.getCode(candidate);
    if (code !== '0x') {
      console.log(`  Reusing RegularSpaceToken impl: ${candidate}`);
      return candidate;
    }
    if (explicit) {
      throw new Error(
        `REGULAR_SPACE_TOKEN_IMPL has no code on-chain: ${candidate}`,
      );
    }
  }

  console.log('  Deploying RegularSpaceToken implementation...');
  const RST = await ethers.getContractFactory(REGULAR_SPACE_TOKEN_FQN);
  const rstContract = await RST.deploy();
  await rstContract.waitForDeployment();
  const addr = await rstContract.getAddress();
  console.log(`  RegularSpaceToken impl: ${addr}`);
  return addr;
}

// ── Step 3: Factory ──────────────────────────────────────────────────────────

async function deployFactory(
  energyPPAv2Impl: string,
  rstImpl: string,
): Promise<string> {
  const existing = getEnv('ENERGY_PPAV2_FACTORY');
  if (existing && ethers.isAddress(existing)) {
    const code = await ethers.provider.getCode(existing);
    if (code === '0x')
      throw new Error(`ENERGY_PPAV2_FACTORY has no code: ${existing}`);
    console.log(`  Reusing factory: ${existing}`);
    return existing;
  }

  console.log('  Deploying EnergyPPAv2Factory...');
  const Factory = await ethers.getContractFactory('EnergyPPAv2Factory');
  const factory = await Factory.deploy(energyPPAv2Impl, rstImpl);
  await factory.waitForDeployment();
  const addr = await factory.getAddress();
  console.log(`  EnergyPPAv2Factory: ${addr}`);
  return addr;
}

// ── Step 4: Community ────────────────────────────────────────────────────────

async function deployCommunity(
  factoryAddress: string,
  adminAddress: string,
  actors: { households: string[]; investors: string[] },
): Promise<DeploymentState> {
  const factory = await ethers.getContractAt(
    'EnergyPPAv2Factory',
    factoryAddress,
  );
  const network = await ethers.provider.getNetwork();
  const stablecoin = getEnv('STABLECOIN_ADDRESS') ?? BASE_MAINNET_USDC;

  const [h1, h2, h3, h4, h5] = actors.households;
  const [inv1, inv2] = actors.investors;

  console.log('\n  Community parameters:');
  console.log(`    Stablecoin        : ${stablecoin}`);
  console.log(
    `    Solar price       : ${SOLAR_BASE_PRICE_PER_KWH} units/kWh ($0.08)`,
  );
  console.log(
    `    Battery price     : ${BATTERY_BASE_PRICE_PER_KWH} units/kWh ($0.12)`,
  );
  console.log(`    Community fee     : ${COMMUNITY_FEE_BPS / 100}%`);
  console.log(`    Aggregator fee    : ${AGGREGATOR_FEE_BPS / 100}%`);
  console.log(`    Export device     : ${EXPORT_DEVICE_ID}`);
  console.log('    Solar ownership   : HH1–5 × 10%, INV1–2 × 25%');
  console.log('    Battery ownership : INV1 50%, INV2 50%');

  const tx = await factory.deployCommunity({
    admin: adminAddress,
    stablecoin,
    communityAddress: adminAddress,
    aggregatorAddress: adminAddress,
    gridOperator: adminAddress,
    communityFeeBps: COMMUNITY_FEE_BPS,
    aggregatorFeeBps: AGGREGATOR_FEE_BPS,
    exportDeviceId: EXPORT_DEVICE_ID,
    energyTokenName: 'Community Energy Credit',
    energyTokenSymbol: 'NRG',
    sources: [
      {
        sourceId: SOLAR_SOURCE_ID,
        sourceType: 0, // SOLAR
        tokenName: 'Solar Park Ownership',
        tokenSymbol: 'SOLAR-1',
        basePricePerKwh: SOLAR_BASE_PRICE_PER_KWH,
        holders: [h1, h2, h3, h4, h5, inv1, inv2],
        holderAmounts: [
          SOLAR_HH_TOKENS,
          SOLAR_HH_TOKENS,
          SOLAR_HH_TOKENS,
          SOLAR_HH_TOKENS,
          SOLAR_HH_TOKENS,
          SOLAR_INV_TOKENS,
          SOLAR_INV_TOKENS,
        ],
      },
      {
        sourceId: BATTERY_SOURCE_ID,
        sourceType: 1, // BATTERY
        tokenName: 'Battery Storage Ownership',
        tokenSymbol: 'BAT-1',
        basePricePerKwh: BATTERY_BASE_PRICE_PER_KWH,
        holders: [inv1, inv2],
        holderAmounts: [BATTERY_INV_TOKENS, BATTERY_INV_TOKENS],
      },
    ],
    members: [
      {
        memberAddress: h1,
        deviceIds: [HOUSEHOLD_DEVICE_IDS[0]],
        metadataHash: ethers.ZeroHash,
      },
      {
        memberAddress: h2,
        deviceIds: [HOUSEHOLD_DEVICE_IDS[1]],
        metadataHash: ethers.ZeroHash,
      },
      {
        memberAddress: h3,
        deviceIds: [HOUSEHOLD_DEVICE_IDS[2]],
        metadataHash: ethers.ZeroHash,
      },
      {
        memberAddress: h4,
        deviceIds: [HOUSEHOLD_DEVICE_IDS[3]],
        metadataHash: ethers.ZeroHash,
      },
      {
        memberAddress: h5,
        deviceIds: [HOUSEHOLD_DEVICE_IDS[4]],
        metadataHash: ethers.ZeroHash,
      },
      { memberAddress: inv1, deviceIds: [], metadataHash: ethers.ZeroHash },
      { memberAddress: inv2, deviceIds: [], metadataHash: ethers.ZeroHash },
    ],
    // Optimization strategy (REC Level 1 + Level 2):
    //   Ranking 1A>1B>1C (Self-Consumption > Min CO2 > Lowest Price)
    //   Social allocation disabled (NONE)
    purposeRanking: [0, 1, 2],
    socialMode: 0,
    socialFixedKwh: 0,
    socialVariableBps: 0,
    socialWallets: [],
    socialWalletShares: [],
  });

  console.log(`\n  deployCommunity tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('deployCommunity: no receipt');
  console.log(
    `  Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed})`,
  );

  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === 'CommunityDeployed');

  if (!event) throw new Error('CommunityDeployed event not found');

  const communityId = event.args.communityId;
  const proxy = event.args.proxy as string;
  const energyToken = event.args.energyToken as string;
  const sourceTokens = event.args.sourceTokens as string[];

  const implAddr = await factory.implementation();
  const rstImplAddr = await factory.regularSpaceTokenImplementation();

  return {
    networkChainId: Number(network.chainId),
    deployer: adminAddress,
    energyPPAv2Implementation: implAddr,
    regularSpaceTokenImplementation: rstImplAddr,
    factory: factoryAddress,
    communityId: communityId.toString(),
    ppaProxy: proxy,
    energyToken,
    solarSourceId: SOLAR_SOURCE_ID,
    solarToken: sourceTokens[0],
    batterySourceId: BATTERY_SOURCE_ID,
    batteryToken: sourceTokens[1],
    households: actors.households,
    investors: actors.investors,
    communityAddress: adminAddress,
    aggregatorAddress: adminAddress,
    deployedAt: new Date().toISOString(),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployerAddress);
  const dryRun = getEnv('DRY_RUN')?.toLowerCase() === 'true';
  // FACTORY_ONLY deploys just the EnergyPPAv2 implementation + factory and
  // skips the demo `deployCommunity` (no actor addresses required). The real
  // community is created later via the app's Enable Energy Community proposal.
  const factoryOnly = getEnv('FACTORY_ONLY')?.toLowerCase() === 'true';

  console.log('='.repeat(72));
  console.log('DEPLOY EnergyPPAv2 Community — Base Mainnet');
  console.log('='.repeat(72));
  console.log(`Network   : chainId ${network.chainId}`);
  console.log(`Deployer  : ${deployerAddress}`);
  console.log(`Balance   : ${ethers.formatEther(balance)} ETH`);
  console.log(`Dry run   : ${dryRun ? 'YES' : 'NO'}`);
  console.log(`Factory only: ${factoryOnly ? 'YES' : 'NO'}`);

  const actors = factoryOnly
    ? { households: [], investors: [] }
    : deriveActors();
  if (!factoryOnly) {
    console.log('\nActors:');
    actors.households.forEach((a, i) => console.log(`  HH${i + 1}  : ${a}`));
    actors.investors.forEach((a, i) => console.log(`  INV${i + 1} : ${a}`));
  }

  if (dryRun) {
    console.log('\nDRY_RUN=true — validated config. No transactions sent.');
    return;
  }

  // Step 1: EnergyPPAv2 implementation
  console.log('\n[1/4] EnergyPPAv2 implementation');
  const existingFactory = getEnv('ENERGY_PPAV2_FACTORY');
  let energyPPAv2Impl: string;
  if (existingFactory) {
    console.log('  (skipped — reusing existing factory)');
    energyPPAv2Impl = 'see factory';
  } else {
    console.log('  Deploying EnergyPPAv2 implementation...');
    const EnergyPPAv2 = await ethers.getContractFactory('EnergyPPAv2');
    const ppaImplContract = await EnergyPPAv2.deploy();
    await ppaImplContract.waitForDeployment();
    energyPPAv2Impl = await ppaImplContract.getAddress();
    console.log(`  EnergyPPAv2 impl: ${energyPPAv2Impl}`);
  }

  // Step 2: RegularSpaceToken implementation
  console.log('\n[2/4] RegularSpaceToken implementation');
  let rstImpl: string;
  if (existingFactory) {
    console.log('  (skipped — reusing existing factory)');
    rstImpl = 'see factory';
  } else {
    rstImpl = await resolveRSTImplementation();
  }

  // Step 3: Factory
  console.log('\n[3/4] EnergyPPAv2Factory');
  const factoryAddress = await deployFactory(energyPPAv2Impl, rstImpl);

  if (factoryOnly) {
    console.log('\n' + '='.repeat(72));
    console.log('FACTORY DEPLOYMENT COMPLETE (community skipped)');
    console.log('='.repeat(72));
    console.log(`  EnergyPPAv2 impl  : ${energyPPAv2Impl}`);
    console.log(`  RegularSpaceToken : ${rstImpl}`);
    console.log(`  EnergyPPAv2Factory: ${factoryAddress}`);
    console.log(
      `\n  Next: bump energyPpaV2FactoryAddress[8453] to ${factoryAddress} in packages/core/src/energy/client/contracts.ts`,
    );

    const addressesPath = path.join(__dirname, '..', '..', 'addresses.json');
    let addresses: Record<string, string> = {};
    if (fs.existsSync(addressesPath)) {
      addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));
    }
    addresses['energyPPAv2Implementation'] = energyPPAv2Impl;
    addresses['energyPPAv2Factory'] = factoryAddress;
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`Updated: ${addressesPath}`);
    return;
  }

  // Step 4: Community
  console.log('\n[4/4] deployCommunity()');
  const state = await deployCommunity(factoryAddress, deployerAddress, actors);

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(72));
  console.log('DEPLOYMENT COMPLETE');
  console.log('='.repeat(72));
  console.log(`  Factory           : ${state.factory}`);
  console.log(`  PPA Proxy         : ${state.ppaProxy}`);
  console.log(`  EnergyToken       : ${state.energyToken}`);
  console.log(`  Solar Token       : ${state.solarToken}`);
  console.log(`  Battery Token     : ${state.batteryToken}`);
  console.log(`  Community ID      : ${state.communityId}`);

  const outPath = path.join(
    __dirname,
    `energy-ppa-v2-deployment-${Date.now()}.json`,
  );
  fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
  console.log(`\nState saved: ${outPath}`);

  const addressesPath = path.join(__dirname, '..', '..', 'addresses.json');
  let addresses: Record<string, string> = {};
  if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));
  }
  addresses['energyPPAv2Factory'] = state.factory;
  addresses['energyPPAv2Proxy'] = state.ppaProxy;
  addresses['energyPPAv2EnergyToken'] = state.energyToken;
  addresses['energyPPAv2SolarToken'] = state.solarToken;
  addresses['energyPPAv2BatteryToken'] = state.batteryToken;
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`Updated: ${addressesPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
