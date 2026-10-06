import { ethers, upgrades } from 'hardhat';

/**
 * Deploys OSwaps and RainbowFactory as UUPS proxies.
 *
 * The deployer becomes `owner` of both proxies and is the only account that
 * can upgrade them. OSwaps operational actions stay with the manager. The
 * owner can replace that manager at any time via setManager.
 *
 * OSWAPS_MANAGER overrides the manager. It defaults to the LocalScale pool
 * manager.
 *
 * Usage:
 *   pnpm --filter @hypha-platform/storage-evm run script \
 *     scripts/oswaps.deploy.ts --network base-mainnet
 */
const DEFAULT_MANAGER = '0xf3c84d4d116c219ad93e5699708296ff0a55ff76';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const manager = process.env.OSWAPS_MANAGER || DEFAULT_MANAGER;

  if (!ethers.isAddress(manager)) {
    throw new Error(`OSWAPS_MANAGER is not a valid address: ${manager}`);
  }

  console.log('Deploying with admin address:', deployerAddress);
  console.log('OSwaps manager:', manager);

  const OSwaps = await ethers.getContractFactory('OSwaps');
  const oswaps = await upgrades.deployProxy(OSwaps, [deployerAddress], {
    initializer: 'initialize',
    kind: 'uups',
  });
  await oswaps.waitForDeployment();
  const oswapsAddress = await oswaps.getAddress();
  console.log('OSwaps deployed to:', oswapsAddress);
  console.log(
    'OSwaps implementation:',
    await upgrades.erc1967.getImplementationAddress(oswapsAddress),
  );

  const initTx = await oswaps.init(manager);
  await initTx.wait();
  console.log('OSwaps initialized. Manager:', manager);

  const RainbowFactory = await ethers.getContractFactory('RainbowFactory');
  const rainbowFactory = await upgrades.deployProxy(
    RainbowFactory,
    [deployerAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );
  await rainbowFactory.waitForDeployment();
  const rainbowFactoryAddress = await rainbowFactory.getAddress();
  console.log('RainbowFactory deployed to:', rainbowFactoryAddress);
  console.log(
    'RainbowFactory implementation:',
    await upgrades.erc1967.getImplementationAddress(rainbowFactoryAddress),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
