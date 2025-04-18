import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log(
    'Deploying DecayingTokenFactory with admin address:',
    adminAddress,
  );

  const DecayingTokenFactory = await ethers.getContractFactory(
    'DecayingTokenFactory', // Use the actual contract name from the .sol file
  );
  console.log('Deploying DecayingTokenFactory...');

  const decayingTokenFactory = await upgrades.deployProxy(
    DecayingTokenFactory,
    [adminAddress], // Arguments for the initializer function
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await decayingTokenFactory.waitForDeployment();
  console.log(
    'DecayingTokenFactory proxy deployed to:',
    await decayingTokenFactory.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
