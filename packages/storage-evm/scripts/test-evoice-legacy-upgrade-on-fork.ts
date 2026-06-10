import { artifacts, ethers, network, upgrades } from 'hardhat';

/**
 * Tests upgrading the Hypha Energy Voice (EVOICE) proxy to
 * DecayingSpaceTokenLegacy on a local fork of Base mainnet.
 *
 * The deployed EVOICE implementation predates space whitelists, mutual credit,
 * token sale and authorized minters, so its decay variables live at slots 8-13.
 * DecayingSpaceTokenLegacy keeps that layout. This script:
 *
 * 1. Statically asserts the compiled storage layout (slots 0-13) matches the
 *    deployed contract exactly.
 * 2. Forks Base, snapshots all live state including real holder balances.
 * 3. Impersonates the owner and performs the UUPS upgrade.
 * 4. Asserts every piece of state survived, byte for byte.
 * 5. Exercises the new functionality (authorized minters mint/burn) and
 *    verifies decay still works after time travel.
 *
 * Run with: npx hardhat run scripts/test-evoice-legacy-upgrade-on-fork.ts --network hardhat
 */

const PROXY_ADDRESS = '0x564c52008898E1a46825dEbf20d5000CBe74800f'; // EVOICE
const OWNER_ADDRESS = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';
const EXECUTOR_ADDRESS = '0x3A5a7b51575728CD36b8F2d30465f1E54B6Df1F4';

// Expected layout of the LEGACY storage prefix — must match the deployed
// EVOICE implementation (verified on-chain: slot 8 = decayPercentage = 1,
// slot 9 = decayRate = 2592000, slot 13 = totalBurnedFromDecay).
const EXPECTED_LEGACY_LAYOUT: Array<[string, string, number]> = [
  ['spaceId', '0', 0],
  ['maxSupply', '1', 0],
  ['transferable', '2', 0],
  ['executor', '2', 1],
  ['transferHelper', '3', 0],
  ['fixedMaxSupply', '3', 20],
  ['autoMinting', '3', 21],
  ['priceInUSD', '4', 0],
  ['canTransfer', '5', 0],
  ['canReceive', '6', 0],
  ['useTransferWhitelist', '7', 0],
  ['useReceiveWhitelist', '7', 1],
  ['archived', '7', 2],
  ['decayPercentage', '8', 0],
  ['decayRate', '9', 0],
  ['lastApplied', '10', 0],
  ['_tokenHolders', '11', 0],
  ['_isTokenHolder', '12', 0],
  ['totalBurnedFromDecay', '13', 0],
];

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function assertStorageLayout(): Promise<void> {
  console.log('=== Step 0: Verifying compiled storage layout ===');
  const buildInfo = await artifacts.getBuildInfo(
    'contracts/DecayingSpaceTokenLegacy.sol:DecayingSpaceTokenLegacy',
  );
  if (!buildInfo) {
    fail('Build info not found — compile first');
  }
  const layout = (
    buildInfo.output.contracts['contracts/DecayingSpaceTokenLegacy.sol'][
      'DecayingSpaceTokenLegacy'
    ] as any
  ).storageLayout;
  if (!layout) {
    fail('storageLayout missing — enable it in hardhat.config outputSelection');
  }

  const storage: Array<{ label: string; slot: string; offset: number }> =
    layout.storage;

  for (let i = 0; i < EXPECTED_LEGACY_LAYOUT.length; i++) {
    const [label, slot, offset] = EXPECTED_LEGACY_LAYOUT[i];
    const actual = storage[i];
    if (
      !actual ||
      actual.label !== label ||
      actual.slot !== slot ||
      actual.offset !== offset
    ) {
      fail(
        `Layout mismatch at index ${i}: expected ${label}@${slot}+${offset}, ` +
          `got ${actual?.label}@${actual?.slot}+${actual?.offset}`,
      );
    }
    console.log(`  ✅ slot ${slot.padStart(2)}+${offset} ${label}`);
  }

  // Everything appended after the legacy prefix must start at slot 14+.
  const next = storage[EXPECTED_LEGACY_LAYOUT.length];
  if (!next || BigInt(next.slot) < 14n) {
    fail(`First appended variable must be at slot >= 14, got ${next?.slot}`);
  }
  console.log(
    `  ✅ appended storage starts at slot ${next.slot} (${next.label})`,
  );
  console.log('');
}

async function impersonate(address: string) {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  await network.provider.send('hardhat_setBalance', [
    address,
    '0x56BC75E2D63100000', // 100 ETH
  ]);
  return ethers.getSigner(address);
}

async function readTokenHolders(): Promise<string[]> {
  // _tokenHolders is private; read it from raw storage (slot 11).
  const lengthHex = await ethers.provider.getStorage(PROXY_ADDRESS, 11);
  const length = Number(BigInt(lengthHex));
  const base = BigInt(
    ethers.keccak256(ethers.zeroPadValue(ethers.toBeHex(11), 32)),
  );
  const holders: string[] = [];
  for (let i = 0; i < length; i++) {
    const raw = await ethers.provider.getStorage(
      PROXY_ADDRESS,
      base + BigInt(i),
    );
    holders.push(ethers.getAddress('0x' + raw.slice(-40)));
  }
  return holders;
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('TESTING EVOICE LEGACY-LAYOUT UPGRADE ON FORKED BASE MAINNET');
  console.log('='.repeat(60));
  console.log('');

  await assertStorageLayout();

  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== 31337n) {
    fail('This script must be run on a local fork. Use --network hardhat');
  }

  console.log('Resetting fork to current mainnet state...');
  await network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.RPC_URL || 'https://mainnet.base.org',
        },
      },
    ],
  });
  console.log('');

  console.log('=== Step 1: Reading current contract state ===');
  const Legacy = await ethers.getContractFactory('DecayingSpaceTokenLegacy');
  const token = Legacy.attach(PROXY_ADDRESS) as any;

  const holders = await readTokenHolders();
  console.log(`Token holders tracked on-chain: ${holders.length}`);
  if (holders.length === 0) {
    fail('Expected a non-empty holder list');
  }

  const stateBefore = {
    name: await token.name(),
    symbol: await token.symbol(),
    totalSupply: await token.totalSupply(),
    decimals: await token.decimals(),
    executor: await token.executor(),
    owner: await token.owner(),
    spaceId: await token.spaceId(),
    maxSupply: await token.maxSupply(),
    transferable: await token.transferable(),
    transferHelper: await token.transferHelper(),
    archived: await token.archived(),
    useTransferWhitelist: await token.useTransferWhitelist(),
    useReceiveWhitelist: await token.useReceiveWhitelist(),
    priceInUSD: await token.priceInUSD(),
    decayPercentage: await token.decayPercentage(),
    decayRate: await token.decayRate(),
    totalBurnedFromDecay: await token.totalBurnedFromDecay(),
  };
  for (const [k, v] of Object.entries(stateBefore)) {
    console.log(`  ${k}: ${v}`);
  }

  // Raw ERC20 balances (super.balanceOf) for every holder, via raw storage of
  // the OZ ERC20 namespaced slot, so decay views don't interfere with the
  // before/after comparison.
  const decayedBalancesBefore = new Map<string, bigint>();
  const lastAppliedBefore = new Map<string, bigint>();
  for (const holder of holders) {
    decayedBalancesBefore.set(holder, await token.balanceOf(holder));
    lastAppliedBefore.set(holder, await token.lastApplied(holder));
  }
  const decayedTotalBefore = await token.getDecayedTotalSupply();
  console.log(`  getDecayedTotalSupply: ${decayedTotalBefore}`);

  const implBefore = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log(`  implementation: ${implBefore}`);
  console.log('');

  console.log('=== Step 2: Impersonating owner and upgrading ===');
  const ownerSigner = await impersonate(OWNER_ADDRESS);

  // Validate the implementation contract (initializers disabled, no
  // constructor state, UUPS-compatible), then deploy it and call
  // upgradeToAndCall directly as the proxy owner — same call the real
  // mainnet upgrade makes. Avoids the plugin manifest, which has no record
  // of the legacy proxy; layout safety is asserted in Step 0 instead.
  await upgrades.validateImplementation(Legacy, { kind: 'uups' });
  console.log('Implementation validated by upgrades plugin');

  const newImplContract = await Legacy.deploy();
  await newImplContract.waitForDeployment();
  const newImplAddress = await newImplContract.getAddress();
  console.log(`New implementation deployed: ${newImplAddress}`);

  const upgraded = Legacy.attach(PROXY_ADDRESS) as any;
  const upgradeTx = await upgraded
    .connect(ownerSigner)
    .upgradeToAndCall(newImplAddress, '0x');
  await upgradeTx.wait();

  const implAfter = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log(`New implementation: ${implAfter}`);
  if (implAfter.toLowerCase() === implBefore.toLowerCase()) {
    fail('Implementation did not change');
  }
  console.log('');

  console.log('=== Step 3: Verifying state preservation ===');
  const stateAfter: Record<string, unknown> = {
    name: await upgraded.name(),
    symbol: await upgraded.symbol(),
    totalSupply: await upgraded.totalSupply(),
    decimals: await upgraded.decimals(),
    executor: await upgraded.executor(),
    owner: await upgraded.owner(),
    spaceId: await upgraded.spaceId(),
    maxSupply: await upgraded.maxSupply(),
    transferable: await upgraded.transferable(),
    transferHelper: await upgraded.transferHelper(),
    archived: await upgraded.archived(),
    useTransferWhitelist: await upgraded.useTransferWhitelist(),
    useReceiveWhitelist: await upgraded.useReceiveWhitelist(),
    priceInUSD: await upgraded.priceInUSD(),
    decayPercentage: await upgraded.decayPercentage(),
    decayRate: await upgraded.decayRate(),
    totalBurnedFromDecay: await upgraded.totalBurnedFromDecay(),
  };

  let allMatch = true;
  for (const [key, before] of Object.entries(stateBefore)) {
    const after = stateAfter[key];
    if (String(before) !== String(after)) {
      console.log(`  ❌ ${key}: ${before} -> ${after}`);
      allMatch = false;
    } else {
      console.log(`  ✅ ${key}: ${after}`);
    }
  }
  if (!allMatch) {
    fail('State was corrupted by the upgrade!');
  }

  console.log('');
  console.log(
    `Checking ${holders.length} holder balances + decay timestamps...`,
  );
  for (const holder of holders) {
    const balance = await upgraded.balanceOf(holder);
    const last = await upgraded.lastApplied(holder);
    if (balance !== decayedBalancesBefore.get(holder)) {
      fail(
        `Balance changed for ${holder}: ${decayedBalancesBefore.get(
          holder,
        )} -> ${balance}`,
      );
    }
    if (last !== lastAppliedBefore.get(holder)) {
      fail(`lastApplied changed for ${holder}`);
    }
  }
  console.log('  ✅ All holder balances and lastApplied timestamps preserved');

  const decayedTotalAfter = await upgraded.getDecayedTotalSupply();
  if (decayedTotalAfter !== decayedTotalBefore) {
    fail(
      `getDecayedTotalSupply changed: ${decayedTotalBefore} -> ${decayedTotalAfter}`,
    );
  }
  console.log(`  ✅ getDecayedTotalSupply preserved: ${decayedTotalAfter}`);

  // New storage must read as zero / disabled.
  if ((await upgraded.tokenPrice()) !== 0n) fail('tokenPrice should be 0');
  if ((await upgraded.paymentToken()) !== ethers.ZeroAddress)
    fail('paymentToken should be zero address');
  if ((await upgraded.defaultCreditLimit()) !== 0n)
    fail('defaultCreditLimit should be 0');
  if ((await upgraded.getTransferWhitelistedSpaces()).length !== 0)
    fail('transfer whitelist spaces should be empty');
  if ((await upgraded.getReceiveWhitelistedSpaces()).length !== 0)
    fail('receive whitelist spaces should be empty');
  if (await upgraded.isAuthorizedMinter(OWNER_ADDRESS))
    fail('owner should not be an authorized minter');
  console.log('  ✅ All new storage reads as zero (features disabled)');
  console.log('');

  console.log('=== Step 4: Testing new functionality ===');

  // Owner must NOT be able to mint (executor-only access control preserved).
  try {
    await upgraded.connect(ownerSigner).mint(OWNER_ADDRESS, 1n);
    fail('Owner should not be able to mint');
  } catch {
    console.log('  ✅ Owner cannot mint (as expected)');
  }

  // Executor grants an authorized minter key.
  const executorSigner = await impersonate(EXECUTOR_ADDRESS);
  const [minter] = await ethers.getSigners();
  await upgraded
    .connect(executorSigner)
    .batchSetAuthorizedMinters([minter.address], [true]);
  if (!(await upgraded.isAuthorizedMinter(minter.address))) {
    fail('Authorized minter was not set');
  }
  console.log(`  ✅ Executor granted authorized minter: ${minter.address}`);

  // Authorized minter mints to a fresh address.
  const recipient = ethers.Wallet.createRandom().address;
  const mintAmount = ethers.parseEther('100');
  await upgraded.connect(minter).mint(recipient, mintAmount);
  if ((await upgraded.balanceOf(recipient)) !== mintAmount) {
    fail('Mint by authorized minter failed');
  }
  if ((await upgraded.lastApplied(recipient)) === 0n) {
    fail('lastApplied not initialized on mint');
  }
  console.log(
    '  ✅ Authorized minter minted 100 EVOICE, decay tracking initialized',
  );

  // Authorized minter burns without approval.
  await upgraded.connect(minter).burnFrom(recipient, ethers.parseEther('40'));
  if ((await upgraded.balanceOf(recipient)) !== ethers.parseEther('60')) {
    fail('burnFrom by authorized minter failed');
  }
  console.log('  ✅ Authorized minter burned 40 EVOICE without approval');

  console.log('');
  console.log('=== Step 5: Verifying decay still works (time travel) ===');
  const decayRate = await upgraded.decayRate();
  const balBeforeDecay: bigint = await upgraded.balanceOf(recipient);
  await network.provider.send('evm_increaseTime', [Number(decayRate)]);
  await network.provider.send('evm_mine');
  const balAfterDecay: bigint = await upgraded.balanceOf(recipient);
  if (balAfterDecay >= balBeforeDecay) {
    fail(`Decay not applied: ${balBeforeDecay} -> ${balAfterDecay}`);
  }
  console.log(`  ✅ View decay: ${balBeforeDecay} -> ${balAfterDecay}`);

  const burnedBefore = await upgraded.totalBurnedFromDecay();
  await upgraded.applyDecay(recipient);
  const burnedAfter = await upgraded.totalBurnedFromDecay();
  if (burnedAfter <= burnedBefore) {
    fail('applyDecay did not increase totalBurnedFromDecay');
  }
  console.log(
    `  ✅ applyDecay burned tokens: totalBurnedFromDecay ${burnedBefore} -> ${burnedAfter}`,
  );

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ALL TESTS PASSED! EVOICE LEGACY UPGRADE IS SAFE TO PERFORM');
  console.log('='.repeat(60));
  console.log('');
  console.log('Run the actual upgrade on mainnet with:');
  console.log(
    '  npx hardhat run scripts/evoice-decaying-space-token-legacy.upgrade.ts --network base-mainnet',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
