/**
 * Upgrade the RSUT proxy to the current DecayingSpaceToken implementation and
 * authorise a minting relayer.
 *
 * Background: RSUT (space 889) was deployed from a build that predates
 * `isAuthorizedMinter`, so today only the Executor can mint — and the Executor
 * only acts on a passed governance proposal, which is far too heavy for handing
 * out a joining bonus. Upgrading gives the owner the ability to authorise a
 * relayer key, which the campaign app then uses to mint directly.
 *
 *   node scripts/rsut-upgrade.mjs                 # dry run, touches nothing
 *   node scripts/rsut-upgrade.mjs --execute       # sign and send
 *
 * Execution needs RSUT_OWNER_PRIVATE_KEY (the key for the owner EOA below).
 * Pass --relayer 0x… to authorise a minter in the same run; it can also be done
 * later, since it is a separate transaction either way.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  keccak256,
  pad,
  toFunctionSelector,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const PROXY = '0xaacf3eb65badeebf3206c5d241b851c7c8fc2ac1';
const EXPECTED_OWNER = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';

/**
 * The implementation DecayingTokenFactory deploys for every new space token —
 * same byte length as a local build of DecayingSpaceToken.sol. Reusing it means
 * RSUT ends up running exactly the code every other Hypha token runs, and no
 * new implementation has to be deployed or verified.
 */
const TARGET_IMPL = '0x02603dEf639871e6EC6cd7aB3230E15CDD0208D9';

const IMPL_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const AUTHORIZED_MINTER_SLOT = 28n;

const abi = [
  { name: 'upgradeToAndCall', type: 'function', stateMutability: 'payable', inputs: [{ type: 'address' }, { type: 'bytes' }], outputs: [] },
  { name: 'batchSetAuthorizedMinters', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address[]' }, { type: 'bool[]' }], outputs: [] },
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [] },
  { name: 'isAuthorizedMinter', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'decayPercentage', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'decayRate', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'executor', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'spaceId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'transferable', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
];

const { values: opts } = parseArgs({
  options: {
    execute: { type: 'boolean', default: false },
    relayer: { type: 'string' },
    rpc: { type: 'string', default: process.env.RPC_URL ?? 'https://mainnet.base.org' },
  },
});

const publicClient = createPublicClient({ chain: base, transport: http(opts.rpc) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The public Base RPC throttles aggressively; retry transport errors only. */
async function retry(fn, tries = 8) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return { ok: true, value: await fn() };
    } catch (error) {
      last = error;
      const msg = `${error.shortMessage ?? ''} ${error.message ?? ''}`;
      if (!/HTTP request failed|rate limit|timeout/i.test(msg)) {
        return { ok: false, error };
      }
      await sleep(1200 * (i + 1));
    }
  }
  return { ok: false, error: last };
}

async function read(functionName, args = [], stateOverride) {
  const r = await retry(() =>
    publicClient.readContract({ address: PROXY, abi, functionName, args, stateOverride }),
  );
  await sleep(250);
  if (!r.ok) throw new Error(`read ${functionName} failed: ${r.error.shortMessage ?? r.error.message}`);
  return r.value;
}

async function simulate(account, functionName, args, stateOverride) {
  const r = await retry(() =>
    publicClient.simulateContract({ address: PROXY, abi, functionName, args, account, stateOverride }),
  );
  await sleep(250);
  if (r.ok) return { ok: true };
  const reason =
    r.error.metaMessages?.find((m) => m.includes('reason:'))?.split('reason:')[1]?.trim() ??
    r.error.shortMessage ??
    String(r.error.message).split('\n')[0];
  return { ok: false, reason };
}

function mappingSlot(key, slot) {
  return keccak256(
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [key, slot]),
  );
}

const asUpgraded = [
  { address: PROXY, stateDiff: [{ slot: IMPL_SLOT, value: pad(TARGET_IMPL.toLowerCase()) }] },
];

/** Storage layout of the local DecayingSpaceToken build, for the sanity check. */
function localLayout(name) {
  const dir = new URL('../artifacts/build-info/', import.meta.url).pathname;
  let best = null;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const info = JSON.parse(readFileSync(dir + f, 'utf8'));
    for (const cs of Object.values(info.output?.contracts ?? {})) {
      const l = cs[name]?.storageLayout;
      if (l?.storage?.length && (!best || l.storage.length > best.storage.length)) best = l;
    }
  }
  return best;
}

console.log(`RSUT proxy   ${PROXY}`);
console.log(`target impl  ${TARGET_IMPL}\n`);

// ── 1. What is deployed right now ──────────────────────────────────────────
const currentImplRaw = await retry(() =>
  publicClient.getStorageAt({ address: PROXY, slot: IMPL_SLOT }),
);
if (!currentImplRaw.ok) throw currentImplRaw.error;
const currentImpl = getAddress(`0x${currentImplRaw.value.slice(-40)}`);

const [name, symbol, decimals, supply, owner, executor, spaceId, transferable] =
  await Promise.all([
    read('name'), read('symbol'), read('decimals'), read('totalSupply'),
    read('owner'), read('executor'), read('spaceId'), read('transferable'),
  ]);

console.log('Current state');
console.log(`  ${name} (${symbol}), ${decimals} decimals`);
console.log(`  total supply     ${formatUnits(supply, decimals)} ${symbol}`);
console.log(`  space id         ${spaceId}`);
console.log(`  transferable     ${transferable}`);
console.log(`  owner            ${owner}`);
console.log(`  executor         ${executor}`);
console.log(`  implementation   ${currentImpl}`);

if (currentImpl.toLowerCase() === TARGET_IMPL.toLowerCase()) {
  console.log('\nAlready on the target implementation — nothing to upgrade.');
}
if (getAddress(owner) !== getAddress(EXPECTED_OWNER)) {
  console.log(`\n!! owner is ${owner}, expected ${EXPECTED_OWNER}. Stopping.`);
  process.exit(1);
}

// ── 2. Does the target implementation carry the functions we need? ─────────
console.log('\nTarget implementation');
const targetCode = await retry(() => publicClient.getCode({ address: TARGET_IMPL }));
if (!targetCode.ok || !targetCode.value || targetCode.value === '0x') {
  throw new Error('target implementation has no code');
}
const wanted = {
  'mint(address,uint256)': true,
  'isAuthorizedMinter(address)': true,
  'batchSetAuthorizedMinters(address[],bool[])': true,
  'decayPercentage()': true,
  'upgradeToAndCall(address,bytes)': true,
};
let missing = 0;
for (const sig of Object.keys(wanted)) {
  const selector = toFunctionSelector(`function ${sig}`).slice(2);
  const present = targetCode.value.includes(selector);
  if (!present) missing++;
  console.log(`  ${present ? 'present' : 'MISSING'}  ${sig}`);
}
if (missing) {
  console.log('\n!! target implementation is missing required functions. Stopping.');
  process.exit(1);
}

// ── 3. Storage layout sanity ───────────────────────────────────────────────
const layout = localLayout('DecayingSpaceToken');
if (layout) {
  const slotOf = (label) => layout.storage.find((s) => s.label === label)?.slot;
  console.log('\nStorage layout of the local DecayingSpaceToken build');
  for (const label of ['spaceId', 'executor', 'isAuthorizedMinter', 'decayPercentage']) {
    console.log(`  slot ${String(slotOf(label)).padStart(3)}  ${label}`);
  }
  if (slotOf('isAuthorizedMinter') !== '28') {
    console.log('  !! isAuthorizedMinter moved — re-verify before upgrading.');
  }
}

// ── 4. Simulate the upgrade and the world after it ─────────────────────────
console.log('\nSimulation');
const canUpgrade = await simulate(owner, 'upgradeToAndCall', [TARGET_IMPL, '0x']);
console.log(`  owner can upgrade                ${canUpgrade.ok ? 'yes' : `NO — ${canUpgrade.reason}`}`);
if (!canUpgrade.ok) process.exit(1);

const after = {
  name: await read('name', [], asUpgraded),
  symbol: await read('symbol', [], asUpgraded),
  supply: await read('totalSupply', [], asUpgraded),
  spaceId: await read('spaceId', [], asUpgraded),
  owner: await read('owner', [], asUpgraded),
  executor: await read('executor', [], asUpgraded),
  decay: await read('decayPercentage', [], asUpgraded),
  decayRate: await read('decayRate', [], asUpgraded),
};
const preserved =
  after.name === name &&
  after.symbol === symbol &&
  after.supply === supply &&
  after.spaceId === spaceId &&
  getAddress(after.owner) === getAddress(owner) &&
  getAddress(after.executor) === getAddress(executor);
console.log(`  state preserved after upgrade    ${preserved ? 'yes' : 'NO — DO NOT PROCEED'}`);
console.log(`  decay after upgrade              ${after.decay} % / ${after.decayRate}s (0 = off)`);
if (!preserved) process.exit(1);

const relayer = opts.relayer ? getAddress(opts.relayer) : null;
const probe = relayer ?? '0x0000000000000000000000000000000000001234';
const withMinter = [
  {
    address: PROXY,
    stateDiff: [
      { slot: IMPL_SLOT, value: pad(TARGET_IMPL.toLowerCase()) },
      { slot: mappingSlot(probe, AUTHORIZED_MINTER_SLOT), value: pad('0x01') },
    ],
  },
];
const ownerMints = await simulate(owner, 'mint', [probe, 1n], asUpgraded);
const ownerAuthorises = await simulate(owner, 'batchSetAuthorizedMinters', [[probe], [true]], asUpgraded);
const minterMints = await simulate(probe, 'mint', [probe, 10n ** 18n], withMinter);
console.log(`  owner can mint directly          ${ownerMints.ok ? 'yes' : `no (${ownerMints.reason}) — expected`}`);
console.log(`  owner can authorise a minter     ${ownerAuthorises.ok ? 'yes' : `NO — ${ownerAuthorises.reason}`}`);
console.log(`  authorised minter can mint       ${minterMints.ok ? 'yes' : `NO — ${minterMints.reason}`}`);

// ── 5. Execute ─────────────────────────────────────────────────────────────
if (!opts.execute) {
  console.log('\nDry run only. Calldata, if you would rather sign it elsewhere:');
  console.log(`  to    ${PROXY}`);
  console.log(`  from  ${owner}`);
  console.log(`  data  ${encodeFunctionData({ abi, functionName: 'upgradeToAndCall', args: [TARGET_IMPL, '0x'] })}`);
  if (relayer) {
    console.log('\n  then, to authorise the relayer:');
    console.log(`  data  ${encodeFunctionData({ abi, functionName: 'batchSetAuthorizedMinters', args: [[relayer], [true]] })}`);
  }
  console.log('\nRe-run with --execute to send.');
  process.exit(0);
}

const key = process.env.RSUT_OWNER_PRIVATE_KEY;
if (!key) {
  console.log('\n!! RSUT_OWNER_PRIVATE_KEY is not set.');
  process.exit(1);
}
const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`);
if (getAddress(account.address) !== getAddress(owner)) {
  console.log(`\n!! key is for ${account.address}, but the owner is ${owner}. Stopping.`);
  process.exit(1);
}

const wallet = createWalletClient({ account, chain: base, transport: http(opts.rpc) });

if (currentImpl.toLowerCase() !== TARGET_IMPL.toLowerCase()) {
  console.log('\nSending upgradeToAndCall…');
  const hash = await wallet.writeContract({
    address: PROXY, abi, functionName: 'upgradeToAndCall', args: [TARGET_IMPL, '0x'],
  });
  console.log(`  tx ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ${receipt.status} in block ${receipt.blockNumber}`);
  if (receipt.status !== 'success') process.exit(1);
}

if (relayer) {
  console.log(`\nAuthorising ${relayer} as a minter…`);
  const hash = await wallet.writeContract({
    address: PROXY, abi, functionName: 'batchSetAuthorizedMinters', args: [[relayer], [true]],
  });
  console.log(`  tx ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ${receipt.status} in block ${receipt.blockNumber}`);
}

console.log('\nVerifying on chain');
const finalImplRaw = await retry(() => publicClient.getStorageAt({ address: PROXY, slot: IMPL_SLOT }));
console.log(`  implementation   ${getAddress(`0x${finalImplRaw.value.slice(-40)}`)}`);
console.log(`  total supply     ${formatUnits(await read('totalSupply'), decimals)} ${symbol}`);
console.log(`  decayPercentage  ${await read('decayPercentage')}`);
if (relayer) {
  console.log(`  isAuthorizedMinter(${relayer})  ${await read('isAuthorizedMinter', [relayer])}`);
}
console.log('\nDone.');
