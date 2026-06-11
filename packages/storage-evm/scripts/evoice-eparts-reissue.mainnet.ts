import { ethers, upgrades } from 'hardhat';

/**
 * MAINNET OPERATION — EVOICE + EPARTS upgrade and reissue.
 *
 * For each token:
 *   1. Upgrade proxy to its legacy-layout implementation
 *      (DecayingSpaceTokenLegacy / OwnershipSpaceTokenLegacy)
 *   2. batchSetAuthorizedMinters([OWNER], [true])
 *   3. Burn the full holding of FROM
 *      (EVOICE: applyDecay first, then burn 54,978; EPARTS: burn 55,000)
 *   4. Mint the same amount to TO
 *
 * Every step is idempotent — the script checks on-chain state and skips steps
 * that are already done, so it can be safely re-run after a partial failure.
 *
 * ALWAYS rehearse on a fork first:
 *   npx hardhat run scripts/test-evoice-eparts-reissue-on-fork.ts --network hardhat
 *
 * Then run with the owner key (0x2687...019a) in PRIVATE_KEY:
 *   npx hardhat run scripts/evoice-eparts-reissue.mainnet.ts --network base-mainnet
 */

const EVOICE_PROXY = '0x564c52008898E1a46825dEbf20d5000CBe74800f';
const EPARTS_PROXY = '0x5d3394CAa6D09214aB86CF048e39dea058eC1921';
const OWNER_ADDRESS = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';

const FROM = '0x177A04A0F8f876ad610079a6f7B588fA2CffA325';
const TO = '0x46F32E38F503E8F6c80B59c514f289D26734Ca8D';

const EVOICE_AMOUNT = ethers.parseEther('54978');
const EPARTS_AMOUNT = ethers.parseEther('55000');

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function ensureUpgraded(
  proxy: string,
  factoryName: string,
  signer: any,
): Promise<any> {
  const Factory = await ethers.getContractFactory(factoryName, signer);
  const token = Factory.attach(proxy) as any;

  // Skip if the active implementation already exposes the new interface.
  const currentImpl = await upgrades.erc1967.getImplementationAddress(proxy);
  let alreadyUpgraded = false;
  try {
    await token.isAuthorizedMinter(OWNER_ADDRESS);
    alreadyUpgraded = true;
  } catch {
    alreadyUpgraded = false;
  }
  if (alreadyUpgraded) {
    console.log(`  ⏭  ${factoryName}: already upgraded (impl ${currentImpl})`);
    return token;
  }

  await upgrades.validateImplementation(Factory, { kind: 'uups' });
  console.log(`  Deploying ${factoryName} implementation...`);
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log(`  Implementation deployed: ${implAddress}`);

  console.log('  Upgrading proxy...');
  const tx = await token.upgradeToAndCall(implAddress, '0x');
  console.log(`  tx: ${tx.hash}`);
  await tx.wait();

  const active = await upgrades.erc1967.getImplementationAddress(proxy);
  if (active.toLowerCase() !== implAddress.toLowerCase()) {
    fail(`${factoryName}: implementation not active after upgrade`);
  }
  console.log(`  ✅ Upgraded: ${currentImpl} -> ${implAddress}`);
  return token;
}

async function ensureMinter(token: any, label: string): Promise<void> {
  if (await token.isAuthorizedMinter(OWNER_ADDRESS)) {
    console.log(`  ⏭  ${label}: owner already authorized minter`);
    return;
  }
  const tx = await token.batchSetAuthorizedMinters([OWNER_ADDRESS], [true]);
  console.log(`  tx: ${tx.hash}`);
  await tx.wait();
  if (!(await token.isAuthorizedMinter(OWNER_ADDRESS))) {
    fail(`${label}: failed to authorize owner as minter`);
  }
  console.log(`  ✅ ${label}: owner authorized as minter`);
}

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log('Signer:', signerAddress);

  if (signerAddress.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
    fail(
      `Signer must be the token owner ${OWNER_ADDRESS}, got ${signerAddress}. Check PRIVATE_KEY.`,
    );
  }

  // ==========================================================================
  // EVOICE
  // ==========================================================================
  console.log('');
  console.log('=== EVOICE ===');
  const evoice = await ensureUpgraded(
    EVOICE_PROXY,
    'DecayingSpaceTokenLegacy',
    signer,
  );

  // Sanity: decay config must be intact after upgrade.
  const decayRate = await evoice.decayRate();
  const decayPercentage = await evoice.decayPercentage();
  if (decayRate !== 2592000n || decayPercentage !== 1n) {
    fail(
      `EVOICE decay config wrong after upgrade: rate=${decayRate} pct=${decayPercentage} — ABORT`,
    );
  }
  console.log('  ✅ Decay config intact (rate=2592000, pct=1)');

  await ensureMinter(evoice, 'EVOICE');

  // Burn FROM's full decayed holding.
  let evoiceFromBal: bigint = await evoice.balanceOf(FROM);
  if (evoiceFromBal === 0n) {
    console.log('  ⏭  EVOICE: FROM balance already 0 (burn done)');
  } else {
    if (evoiceFromBal !== EVOICE_AMOUNT) {
      fail(
        `EVOICE: FROM decayed balance is ${ethers.formatEther(
          evoiceFromBal,
        )}, ` +
          `expected exactly 54978. Decay may have advanced a period — ` +
          `re-confirm the burn amount before proceeding.`,
      );
    }
    console.log('  Applying pending decay to FROM...');
    await (await evoice.applyDecay(FROM)).wait();
    evoiceFromBal = await evoice.balanceOf(FROM);
    if (evoiceFromBal !== EVOICE_AMOUNT) {
      fail(
        `EVOICE: FROM balance after applyDecay is ${ethers.formatEther(
          evoiceFromBal,
        )} — ABORT`,
      );
    }
    const burnTx = await evoice.burnFrom(FROM, EVOICE_AMOUNT);
    console.log(`  burn tx: ${burnTx.hash}`);
    await burnTx.wait();
    if ((await evoice.balanceOf(FROM)) !== 0n) {
      fail('EVOICE: FROM balance not zero after burn');
    }
    console.log(
      `  ✅ Burned ${ethers.formatEther(EVOICE_AMOUNT)} EVOICE from ${FROM}`,
    );
  }

  // Mint to TO.
  const evoiceToBal: bigint = await evoice.balanceOf(TO);
  if (evoiceToBal >= EVOICE_AMOUNT) {
    console.log(
      `  ⏭  EVOICE: TO already holds ${ethers.formatEther(
        evoiceToBal,
      )} (mint done)`,
    );
  } else {
    if (evoiceToBal !== 0n) {
      fail(
        `EVOICE: TO holds unexpected partial balance ${ethers.formatEther(
          evoiceToBal,
        )} — resolve manually`,
      );
    }
    const mintTx = await evoice.mint(TO, EVOICE_AMOUNT);
    console.log(`  mint tx: ${mintTx.hash}`);
    await mintTx.wait();
    if ((await evoice.balanceOf(TO)) !== EVOICE_AMOUNT) {
      fail('EVOICE: TO balance wrong after mint');
    }
    console.log(
      `  ✅ Minted ${ethers.formatEther(EVOICE_AMOUNT)} EVOICE to ${TO}`,
    );
  }

  // ==========================================================================
  // EPARTS
  // ==========================================================================
  console.log('');
  console.log('=== EPARTS ===');
  const eparts = await ensureUpgraded(
    EPARTS_PROXY,
    'OwnershipSpaceTokenLegacy',
    signer,
  );

  // Sanity: membership wiring must be intact after upgrade (slot 16).
  const osc = await eparts.ownershipSpacesContract();
  if (osc.toLowerCase() !== '0xc8b8454d2f9192fecabc2c6f5d88f6434a2a9cd9') {
    fail(`EPARTS ownershipSpacesContract wrong after upgrade: ${osc} — ABORT`);
  }
  console.log('  ✅ ownershipSpacesContract intact');

  await ensureMinter(eparts, 'EPARTS');

  // Burn FROM's holding.
  const epartsFromBal: bigint = await eparts.balanceOf(FROM);
  if (epartsFromBal === 0n) {
    console.log('  ⏭  EPARTS: FROM balance already 0 (burn done)');
  } else {
    if (epartsFromBal !== EPARTS_AMOUNT) {
      fail(
        `EPARTS: FROM balance is ${ethers.formatEther(
          epartsFromBal,
        )}, expected exactly 55000 — ABORT`,
      );
    }
    const burnTx = await eparts.burnFrom(FROM, EPARTS_AMOUNT);
    console.log(`  burn tx: ${burnTx.hash}`);
    await burnTx.wait();
    if ((await eparts.balanceOf(FROM)) !== 0n) {
      fail('EPARTS: FROM balance not zero after burn');
    }
    console.log(
      `  ✅ Burned ${ethers.formatEther(EPARTS_AMOUNT)} EPARTS from ${FROM}`,
    );
  }

  // Mint to TO.
  const epartsToBal: bigint = await eparts.balanceOf(TO);
  if (epartsToBal >= EPARTS_AMOUNT) {
    console.log(
      `  ⏭  EPARTS: TO already holds ${ethers.formatEther(
        epartsToBal,
      )} (mint done)`,
    );
  } else {
    if (epartsToBal !== 0n) {
      fail(
        `EPARTS: TO holds unexpected partial balance ${ethers.formatEther(
          epartsToBal,
        )} — resolve manually`,
      );
    }
    const mintTx = await eparts.mint(TO, EPARTS_AMOUNT);
    console.log(`  mint tx: ${mintTx.hash}`);
    await mintTx.wait();
    if ((await eparts.balanceOf(TO)) !== EPARTS_AMOUNT) {
      fail('EPARTS: TO balance wrong after mint');
    }
    console.log(
      `  ✅ Minted ${ethers.formatEther(EPARTS_AMOUNT)} EPARTS to ${TO}`,
    );
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ OPERATION COMPLETE');
  console.log('='.repeat(60));
  console.log('Final balances:');
  console.log(
    `  EVOICE ${FROM}: ${ethers.formatEther(await evoice.balanceOf(FROM))}`,
  );
  console.log(
    `  EVOICE ${TO}: ${ethers.formatEther(await evoice.balanceOf(TO))}`,
  );
  console.log(
    `  EPARTS ${FROM}: ${ethers.formatEther(await eparts.balanceOf(FROM))}`,
  );
  console.log(
    `  EPARTS ${TO}: ${ethers.formatEther(await eparts.balanceOf(TO))}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
