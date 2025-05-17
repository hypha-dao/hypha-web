import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const SpacePaymentTracker = await ethers.getContractFactory(
    'SpacePaymentTracker',
  );
  console.log('Deploying SpacePaymentTracker...');

  const spacePaymentTracker = await upgrades.deployProxy(
    SpacePaymentTracker,
    [adminAddress], // Pass the admin address as initialOwner
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await spacePaymentTracker.waitForDeployment();
  console.log(
    'SpacePaymentTracker deployed to:',
    await spacePaymentTracker.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
