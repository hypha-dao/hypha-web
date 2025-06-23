import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log(
    'Deploying OwnershipTokenFactory with admin address:',
    adminAddress,
  );

  const OwnershipTokenFactory = await ethers.getContractFactory(
    'OwnershipTokenFactory', // Use the actual contract name from the .sol file
  );
  console.log('Deploying OwnershipTokenFactory...');

  const ownershipTokenFactory = await upgrades.deployProxy(
    OwnershipTokenFactory,
    [adminAddress], // Arguments for the initializer function
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await ownershipTokenFactory.waitForDeployment();
  console.log(
    'OwnershipTokenFactory proxy deployed to:',
    await ownershipTokenFactory.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
