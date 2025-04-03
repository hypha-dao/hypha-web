import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const TokenFactory = await ethers.getContractFactory(
    'TokenFactoryImplementation',
  );
  console.log('Deploying TokenFactory...');

  const tokenFactory = await upgrades.deployProxy(
    TokenFactory,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await tokenFactory.waitForDeployment();
  console.log('TokenFactory deployed to:', await tokenFactory.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
