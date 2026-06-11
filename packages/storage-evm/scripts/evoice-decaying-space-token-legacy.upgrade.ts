import { ethers, upgrades } from 'hardhat';

/**
 * Upgrades the Hypha Energy Voice (EVOICE) proxy to DecayingSpaceTokenLegacy.
 *
 * EVOICE was deployed from an early implementation whose storage layout differs
 * from the current DecayingSpaceToken (decay variables at slots 8-13, before
 * space whitelists / credit / sale / minters were added to the base contract).
 * DecayingSpaceTokenLegacy preserves that layout while providing all current
 * functionality. DO NOT upgrade this proxy to DecayingSpaceToken — it would
 * corrupt the decay storage.
 *
 * ALWAYS run the fork test first:
 *   npx hardhat run scripts/test-evoice-legacy-upgrade-on-fork.ts --network hardhat
 *
 * Then run this with the owner key (0x2687...019a):
 *   npx hardhat run scripts/evoice-decaying-space-token-legacy.upgrade.ts --network base-mainnet
 */

const PROXY_ADDRESS = '0x564c52008898E1a46825dEbf20d5000CBe74800f'; // EVOICE

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('Current implementation address:', currentImpl);

  const Legacy = await ethers.getContractFactory('DecayingSpaceTokenLegacy');
  console.log('Contract factory created successfully');

  // Snapshot critical state for post-upgrade verification.
  const token = Legacy.attach(PROXY_ADDRESS) as any;
  const before = {
    totalSupply: await token.totalSupply(),
    decayPercentage: await token.decayPercentage(),
    decayRate: await token.decayRate(),
    totalBurnedFromDecay: await token.totalBurnedFromDecay(),
    executor: await token.executor(),
  };
  console.log('Pre-upgrade state:', before);

  // Validate the implementation contract (initializers disabled, no
  // constructor state, UUPS-compatible), then deploy it and call
  // upgradeToAndCall directly as the proxy owner. The plugin manifest has no
  // record of the legacy proxy; layout safety is guaranteed by the fork test
  // (test-evoice-legacy-upgrade-on-fork.ts) which asserts slots 0-13.
  await upgrades.validateImplementation(Legacy, { kind: 'uups' });
  console.log('Implementation validated by upgrades plugin');

  console.log('Deploying DecayingSpaceTokenLegacy implementation...');
  const newImplContract = await Legacy.deploy();
  await newImplContract.waitForDeployment();
  const newImplAddress = await newImplContract.getAddress();
  console.log('New implementation deployed:', newImplAddress);

  console.log('Upgrading proxy...');
  const upgraded = Legacy.attach(PROXY_ADDRESS) as any;
  const upgradeTx = await upgraded.upgradeToAndCall(newImplAddress, '0x');
  await upgradeTx.wait();

  const newImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('New implementation address:', newImpl);

  if (currentImpl.toLowerCase() === newImpl.toLowerCase()) {
    console.log(
      '⚠️  WARNING: Implementation address did not change! Upgrade may have failed.',
    );
  } else {
    console.log('✅ Implementation address changed successfully!');
  }

  // Post-upgrade state verification.
  const after = {
    totalSupply: await upgraded.totalSupply(),
    decayPercentage: await upgraded.decayPercentage(),
    decayRate: await upgraded.decayRate(),
    totalBurnedFromDecay: await upgraded.totalBurnedFromDecay(),
    executor: await upgraded.executor(),
  };
  console.log('Post-upgrade state:', after);

  let ok = true;
  for (const key of Object.keys(before) as (keyof typeof before)[]) {
    if (String(before[key]) !== String(after[key])) {
      console.error(`❌ ${key} changed: ${before[key]} -> ${after[key]}`);
      ok = false;
    }
  }
  if (!ok) {
    throw new Error('STATE MISMATCH AFTER UPGRADE — investigate immediately');
  }
  console.log('✅ All checked state preserved');

  console.log('Upgrade process completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
