import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log(
    'Deploying RegularTokenFactory with admin address:',
    adminAddress,
  );

  const RegularTokenFactory = await ethers.getContractFactory(
    'RegularTokenFactory', // Use the actual contract name from the .sol file
  );
  console.log('Deploying RegularTokenFactory...');

  const regularTokenFactory = await upgrades.deployProxy(
    RegularTokenFactory,
    [adminAddress], // Arguments for the initializer function
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await regularTokenFactory.waitForDeployment();
  console.log(
    'RegularTokenFactory proxy deployed to:',
    await regularTokenFactory.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
