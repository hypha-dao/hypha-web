import { artifacts, ethers, network, upgrades } from 'hardhat';

/**
 * Rehearses the full EVOICE + EPARTS reissue operation on a Base mainnet fork:
 *
 * For EVOICE (DecayingSpaceTokenLegacy):
 *   1. Upgrade proxy to DecayingSpaceTokenLegacy
 *   2. batchSetAuthorizedMinters([OWNER], [true])  (as owner)
 *   3. applyDecay(FROM) then burnFrom(FROM, 54,978) (as authorized minter)
 *   4. mint(TO, 54,978)
 *
 * For EPARTS (OwnershipSpaceTokenLegacy):
 *   1. Upgrade proxy to OwnershipSpaceTokenLegacy
 *   2. batchSetAuthorizedMinters([OWNER], [true])
 *   3. burnFrom(FROM, 55,000)
 *   4. mint(TO, 55,000)
 *
 * Includes static storage-layout assertions for both legacy contracts and
 * full state-preservation checks across both upgrades.
 *
 * Run with: npx hardhat run scripts/test-evoice-eparts-reissue-on-fork.ts --network hardhat
 */

const EVOICE_PROXY = '0x564c52008898E1a46825dEbf20d5000CBe74800f';
const EPARTS_PROXY = '0x5d3394CAa6D09214aB86CF048e39dea058eC1921';
const OWNER_ADDRESS = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';

const FROM = '0x177A04A0F8f876ad610079a6f7B588fA2CffA325';
const TO = '0x46F32E38F503E8F6c80B59c514f289D26734Ca8D';

const EVOICE_AMOUNT = ethers.parseEther('54978');
const EPARTS_AMOUNT = ethers.parseEther('55000');

type LayoutEntry = [string, string, number];

const LEGACY_PREFIX_0_TO_7: LayoutEntry[] = [
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
];

const EVOICE_LAYOUT: LayoutEntry[] = [
  ...LEGACY_PREFIX_0_TO_7,
  ['decayPercentage', '8', 0],
  ['decayRate', '9', 0],
  ['lastApplied', '10', 0],
  ['_tokenHolders', '11', 0],
  ['_isTokenHolder', '12', 0],
  ['totalBurnedFromDecay', '13', 0],
];

const EPARTS_LAYOUT: LayoutEntry[] = [
  ...LEGACY_PREFIX_0_TO_7,
  ['_transferWhitelistedSpaceIds', '8', 0],
  ['_receiveWhitelistedSpaceIds', '9', 0],
  ['isTransferWhitelistedSpace', '10', 0],
  ['isReceiveWhitelistedSpace', '11', 0],
  ['priceCurrencyFeed', '12', 0],
  ['tokenPrice', '13', 0],
  ['_customName', '14', 0],
  ['_customSymbol', '15', 0],
  ['ownershipSpacesContract', '16', 0],
];

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function assertStorageLayout(
  contractName: string,
  expected: LayoutEntry[],
  minAppendSlot: number,
): Promise<void> {
  const buildInfo = await artifacts.getBuildInfo(
    `contracts/${contractName}.sol:${contractName}`,
  );
  if (!buildInfo) fail(`Build info not found for ${contractName}`);
  const layout = (
    buildInfo.output.contracts[`contracts/${contractName}.sol`][
      contractName
    ] as any
  ).storageLayout;
  if (!layout) fail('storageLayout missing in compiler output');

  const storage: Array<{ label: string; slot: string; offset: number }> =
    layout.storage;
  for (let i = 0; i < expected.length; i++) {
    const [label, slot, offset] = expected[i];
    const actual = storage[i];
    if (
      !actual ||
      actual.label !== label ||
      actual.slot !== slot ||
      actual.offset !== offset
    ) {
      fail(
        `${contractName} layout mismatch at index ${i}: expected ` +
          `${label}@${slot}+${offset}, got ${actual?.label}@${actual?.slot}+${actual?.offset}`,
      );
    }
  }
  const next = storage[expected.length];
  if (!next || BigInt(next.slot) < BigInt(minAppendSlot)) {
    fail(
      `${contractName}: first appended variable must be at slot >= ${minAppendSlot}, got ${next?.slot}`,
    );
  }
  console.log(
    `  ✅ ${contractName}: ${expected.length} legacy slots verified, appended storage starts at slot ${next.slot}`,
  );
}

async function impersonate(address: string) {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  await network.provider.send('hardhat_setBalance', [
    address,
    '0x56BC75E2D63100000',
  ]);
  return ethers.getSigner(address);
}

async function upgradeProxyTo(
  proxy: string,
  factoryName: string,
  ownerSigner: any,
): Promise<any> {
  const Factory = await ethers.getContractFactory(factoryName);
  await upgrades.validateImplementation(Factory, { kind: 'uups' });
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();

  const token = Factory.attach(proxy) as any;
  const tx = await token
    .connect(ownerSigner)
    .upgradeToAndCall(implAddress, '0x');
  await tx.wait();

  const active = await upgrades.erc1967.getImplementationAddress(proxy);
  if (active.toLowerCase() !== implAddress.toLowerCase()) {
    fail(`${factoryName}: implementation not active after upgrade`);
  }
  console.log(`  ✅ Upgraded ${proxy} -> ${factoryName} @ ${implAddress}`);
  return token;
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('REHEARSING EVOICE + EPARTS REISSUE ON FORKED BASE MAINNET');
  console.log('='.repeat(60));
  console.log('');

  console.log('=== Step 0: Storage layout assertions ===');
  await assertStorageLayout('DecayingSpaceTokenLegacy', EVOICE_LAYOUT, 14);
  await assertStorageLayout('OwnershipSpaceTokenLegacy', EPARTS_LAYOUT, 17);
  console.log('');

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

  const ownerSigner = await impersonate(OWNER_ADDRESS);

  // ==========================================================================
  // EVOICE
  // ==========================================================================
  console.log('=== EVOICE ===');
  const evoice = (
    await ethers.getContractFactory('DecayingSpaceTokenLegacy')
  ).attach(EVOICE_PROXY) as any;

  const evoiceBefore = {
    totalSupply: await evoice.totalSupply(),
    fromBalance: await evoice.balanceOf(FROM),
    toBalance: await evoice.balanceOf(TO),
    decayPercentage: await evoice.decayPercentage(),
    decayRate: await evoice.decayRate(),
    totalBurnedFromDecay: await evoice.totalBurnedFromDecay(),
    executor: await evoice.executor(),
    owner: await evoice.owner(),
    name: await evoice.name(),
    symbol: await evoice.symbol(),
  };
  console.log(
    `  FROM decayed balance: ${ethers.formatEther(evoiceBefore.fromBalance)}`,
  );
  console.log(
    `  TO balance:           ${ethers.formatEther(evoiceBefore.toBalance)}`,
  );

  if (evoiceBefore.fromBalance !== EVOICE_AMOUNT) {
    fail(
      `EVOICE: FROM balance is ${ethers.formatEther(
        evoiceBefore.fromBalance,
      )}, ` +
        `expected exactly 54978 — decay may have advanced; re-check the amount`,
    );
  }

  // 1. Upgrade
  await upgradeProxyTo(EVOICE_PROXY, 'DecayingSpaceTokenLegacy', ownerSigner);

  // State preservation
  if ((await evoice.decayPercentage()) !== evoiceBefore.decayPercentage)
    fail('EVOICE decayPercentage changed');
  if ((await evoice.decayRate()) !== evoiceBefore.decayRate)
    fail('EVOICE decayRate changed');
  if (
    (await evoice.totalBurnedFromDecay()) !== evoiceBefore.totalBurnedFromDecay
  )
    fail('EVOICE totalBurnedFromDecay changed');
  if ((await evoice.totalSupply()) !== evoiceBefore.totalSupply)
    fail('EVOICE totalSupply changed');
  if ((await evoice.balanceOf(FROM)) !== evoiceBefore.fromBalance)
    fail('EVOICE FROM balance changed');
  if ((await evoice.name()) !== evoiceBefore.name) fail('EVOICE name changed');
  if ((await evoice.symbol()) !== evoiceBefore.symbol)
    fail('EVOICE symbol changed');
  console.log('  ✅ EVOICE state preserved after upgrade');

  // 2. Authorize owner as minter
  await (
    await evoice
      .connect(ownerSigner)
      .batchSetAuthorizedMinters([OWNER_ADDRESS], [true])
  ).wait();
  if (!(await evoice.isAuthorizedMinter(OWNER_ADDRESS)))
    fail('EVOICE: owner not authorized as minter');
  console.log('  ✅ Owner authorized as minter');

  // 3. Apply decay, then burn the full decayed balance
  await (await evoice.applyDecay(FROM)).wait();
  const fromAfterDecay: bigint = await evoice.balanceOf(FROM);
  if (fromAfterDecay !== EVOICE_AMOUNT) {
    fail(
      `EVOICE: FROM balance after applyDecay is ${ethers.formatEther(
        fromAfterDecay,
      )}, expected 54978`,
    );
  }
  await (
    await evoice.connect(ownerSigner).burnFrom(FROM, EVOICE_AMOUNT)
  ).wait();
  if ((await evoice.balanceOf(FROM)) !== 0n)
    fail('EVOICE: FROM balance not zero after burn');
  console.log(
    `  ✅ Burned ${ethers.formatEther(EVOICE_AMOUNT)} EVOICE from ${FROM}`,
  );

  // 4. Mint to recipient
  await (await evoice.connect(ownerSigner).mint(TO, EVOICE_AMOUNT)).wait();
  const toBal: bigint = await evoice.balanceOf(TO);
  if (toBal !== evoiceBefore.toBalance + EVOICE_AMOUNT)
    fail(`EVOICE: TO balance is ${ethers.formatEther(toBal)}`);
  if ((await evoice.lastApplied(TO)) === 0n)
    fail('EVOICE: decay tracking not initialized for TO');
  console.log(
    `  ✅ Minted ${ethers.formatEther(
      EVOICE_AMOUNT,
    )} EVOICE to ${TO} (decay tracking on)`,
  );
  console.log('');

  // ==========================================================================
  // EPARTS
  // ==========================================================================
  console.log('=== EPARTS ===');
  const eparts = (
    await ethers.getContractFactory('OwnershipSpaceTokenLegacy')
  ).attach(EPARTS_PROXY) as any;

  const epartsBefore = {
    totalSupply: await eparts.totalSupply(),
    fromBalance: await eparts.balanceOf(FROM),
    toBalance: await eparts.balanceOf(TO),
    executor: await eparts.executor(),
    owner: await eparts.owner(),
    name: await eparts.name(),
    symbol: await eparts.symbol(),
    ownershipSpacesContract: await eparts.ownershipSpacesContract(),
  };
  console.log(
    `  FROM balance: ${ethers.formatEther(epartsBefore.fromBalance)}`,
  );
  console.log(`  TO balance:   ${ethers.formatEther(epartsBefore.toBalance)}`);
  console.log(
    `  ownershipSpacesContract: ${epartsBefore.ownershipSpacesContract}`,
  );

  if (epartsBefore.fromBalance !== EPARTS_AMOUNT) {
    fail(
      `EPARTS: FROM balance is ${ethers.formatEther(
        epartsBefore.fromBalance,
      )}, expected exactly 55000`,
    );
  }

  // 1. Upgrade
  await upgradeProxyTo(EPARTS_PROXY, 'OwnershipSpaceTokenLegacy', ownerSigner);

  // State preservation — ownershipSpacesContract at slot 16 is the critical one
  if (
    (await eparts.ownershipSpacesContract()) !==
    epartsBefore.ownershipSpacesContract
  )
    fail('EPARTS ownershipSpacesContract changed — layout corruption!');
  if ((await eparts.totalSupply()) !== epartsBefore.totalSupply)
    fail('EPARTS totalSupply changed');
  if ((await eparts.balanceOf(FROM)) !== epartsBefore.fromBalance)
    fail('EPARTS FROM balance changed');
  if ((await eparts.name()) !== epartsBefore.name) fail('EPARTS name changed');
  if ((await eparts.symbol()) !== epartsBefore.symbol)
    fail('EPARTS symbol changed');
  if ((await eparts.executor()) !== epartsBefore.executor)
    fail('EPARTS executor changed');
  if ((await eparts.defaultCreditLimit()) !== 0n)
    fail('EPARTS defaultCreditLimit should read 0');
  if ((await eparts.paymentToken()) !== ethers.ZeroAddress)
    fail('EPARTS paymentToken should read zero');
  console.log(
    '  ✅ EPARTS state preserved after upgrade, new storage reads zero',
  );

  // 2. Authorize owner as minter
  await (
    await eparts
      .connect(ownerSigner)
      .batchSetAuthorizedMinters([OWNER_ADDRESS], [true])
  ).wait();
  if (!(await eparts.isAuthorizedMinter(OWNER_ADDRESS)))
    fail('EPARTS: owner not authorized as minter');
  console.log('  ✅ Owner authorized as minter');

  // 3. Burn
  await (
    await eparts.connect(ownerSigner).burnFrom(FROM, EPARTS_AMOUNT)
  ).wait();
  if ((await eparts.balanceOf(FROM)) !== 0n)
    fail('EPARTS: FROM balance not zero after burn');
  console.log(
    `  ✅ Burned ${ethers.formatEther(EPARTS_AMOUNT)} EPARTS from ${FROM}`,
  );

  // 4. Mint (authorized minters bypass the space-member restriction)
  await (await eparts.connect(ownerSigner).mint(TO, EPARTS_AMOUNT)).wait();
  const epartsToBal: bigint = await eparts.balanceOf(TO);
  if (epartsToBal !== epartsBefore.toBalance + EPARTS_AMOUNT)
    fail(`EPARTS: TO balance is ${ethers.formatEther(epartsToBal)}`);
  console.log(
    `  ✅ Minted ${ethers.formatEther(EPARTS_AMOUNT)} EPARTS to ${TO}`,
  );

  // Total supply invariant: burn + mint of the same amount nets to zero
  // (EVOICE total also drops by the decay applied to FROM before the burn).
  if ((await eparts.totalSupply()) !== epartsBefore.totalSupply)
    fail('EPARTS totalSupply should be unchanged after burn+mint');
  console.log('  ✅ EPARTS totalSupply unchanged');

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ALL REHEARSAL STEPS PASSED — SAFE TO RUN ON MAINNET');
  console.log('='.repeat(60));
  console.log('');
  console.log('Execute for real with the owner key:');
  console.log(
    '  npx hardhat run scripts/evoice-eparts-reissue.mainnet.ts --network base-mainnet',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
