import { ethers } from 'hardhat';

/**
 * Deploys the OSwaps pool and hands operational control to a manager.
 *
 * OSwaps is not upgradeable, so this is a plain deployment. The deployer becomes
 * `owner`, whose only power is the one-time `init` call below; every operational
 * action (freeze/unfreeze, withdraw, forgetAsset, manager rotation) belongs to
 * the manager thereafter.
 *
 * Set OSWAPS_MANAGER to the address that should hold that role. It defaults to
 * the deployer, which is fine for a local run but not for a real network.
 *
 * Usage:
 *   OSWAPS_MANAGER=0x... pnpm --filter @hypha-platform/storage-evm run script \
 *     scripts/oswaps.deploy.ts --network base-mainnet
 */
async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const manager = process.env.OSWAPS_MANAGER || deployerAddress;

  if (!ethers.isAddress(manager)) {
    throw new Error(`OSWAPS_MANAGER is not a valid address: ${manager}`);
  }
  if (manager === deployerAddress) {
    console.warn(
      'OSWAPS_MANAGER is unset — defaulting the manager to the deployer.',
    );
  }

  console.log('Deploying OSwaps with deployer:', deployerAddress);

  const OSwaps = await ethers.getContractFactory('OSwaps');
  const oswaps = await OSwaps.deploy();
  await oswaps.waitForDeployment();
  const address = await oswaps.getAddress();
  console.log('OSwaps deployed to:', address);

  const tx = await oswaps.init(manager);
  await tx.wait();
  console.log('Manager set to:', manager);

  console.log(
    '\nNext: register each token with createAsset, then unfreeze it, then make ' +
      'the first deposit with a non-zero weight, then unfreeze it again. ' +
      'See OSwaps.docs.md for the bootstrap sequence.',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
